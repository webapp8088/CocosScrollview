const { ccclass, property, disallowMultiple, menu, requireComponent } = cc._decorator;
@ccclass
@disallowMultiple()
@menu('Saas组件/SaasListView')
export default class SaasListView extends cc.Component {

    @property({ type: cc.Prefab, tooltip: CC_DEV && '模板节点' })
    private templateNode: cc.Prefab = null;

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '节点刷新函数' })
    refreshItemEvents: cc.Component.EventHandler[] = [];

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '节点点击函数' })
    clickItemEvents: cc.Component.EventHandler[] = [];

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '节点刚好出现在屏幕视野里' })
    appearEvents: cc.Component.EventHandler[] = [];

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '滚动到了边界' })
    scrollBoundaryEvents: cc.Component.EventHandler[] = [];

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '节点数据切换' })
    dataChangeEvents: cc.Component.EventHandler[] = [];

    //缺省可滑动
    @property({
        tooltip: CC_DEV && 'Item数量不足以填满Content时，是否可滑动'
    })
    public lackSlide: boolean = false;

    //对象池
    private poolNode: cc.Node[] = [];
    //本地节点
     childrens: cc.Node[] = [];
    //滚动视图
    @property(cc.ScrollView)
    public scrollView: cc.ScrollView = null;
    //布局
    @property(cc.Layout)
    layout: cc.Layout = null;

    /**item的高度 */
    @property
    private itemHeight: number = 0;
    /**item的宽度 */
    @property
    private itemWidth: number = 0;
    /**距离scrollView中心点的距离，超过这个距离的item会被重置，一般设置为 scrollVIew.height/2 + item.heigt/2 + space，因为这个距离item正好超出scrollView显示范围 */
    private halfScrollView: number = 0;
    /**刷新的函数 */
    private updateFun: Function = function () { };
    /**上一次content的Y值，用于和现在content的Y值比较，得出是向上还是向下滚动 */
    private lastContentPosY: number = 0;
    /**上一次content的X值，用于和现在content的X值比较，得出是向左还是向右滚动 */
    private lastContentPosX: number = 0;

    /**应创建的实例数量 */
    private spawnCount: number = 0;

    /**刷新时间，单位s */
    private updateTimer: number = 0;
    /**刷新间隔，单位s */
    private updateInterval: number = 0;

    //布局类型
    private type;
    //多创建几个不可见节点数量
    private prefabNodeNumber = 10;

    /**网格行数 */
    private gridRow: number = 0;
    /**网格列数 */
    private gridCol: number = 0;

    //节点个数
    private _numItems: number;
    public get numItems(): number {
        return this._numItems;
    }
    public set numItems(v: number) {
        if (v == this._numItems) {
            return
        }
        this._numItems = v;
        this.updateContent();
    }

    //是否是添加数据
    private isToltal = false;
    /**
     * @param v 子节点数量
     * @param total 是否是添加 是添加则不切换到顶部
     */
    public changeNumItmes(v:number,total:boolean){
        this.isToltal = total;
        if(total){
            this.numItems = v;
        }else{
            this._numItems = v;
            this.childrens.forEach((item)=>{
                this.removeItem(item);
            })
            this.childrens.length = 0;
            this.updateContent();
        }
    }


    //选中节点下标
    private _selectedId: number = -1;
    public get selectedId(): number {
        return this._selectedId;
    }
    public set selectedId(v: number) {
        if (v == this._selectedId) {
            return;
        }
        this._selectedId = v;
        this.childrens.forEach((node) => {
            let index = node['itemIndex'];
            let checked = this._selectedId == index;
            cc.Component.EventHandler.emitEvents(this.clickItemEvents, node, node['itemIndex'], checked, false);
        });
    }

    /**是否滚动容器 */
    private bScrolling: boolean = false;
    onLoad() {
        this.type = this.layout.type;
        this.layout.type = cc.Layout.Type.NONE;
        this.scrollView.node.on("scrolling", this.onScrolling, this);
    }

    /**获取第一个Item的位置 */
    private updateContent() {
        let type = this.type;
        let startAxis = this.layout.startAxis;
        //显示列表实例为0个
        if (this.childrens.length == 0) {
            this.countListParam();
            this.createList(0, new cc.Vec2(0, 0));
            //显示列表的实例不为0个，则需要重新排列item实例数组
        } else {
            if (type == cc.Layout.Type.VERTICAL) {
                this.childrens.sort((a: any, b: any) => {
                    return b.y - a.y;
                });
            } else if (type == cc.Layout.Type.HORIZONTAL) {
                this.childrens.sort((a: any, b: any) => {
                    return a.x - b.x;
                });
            } else if (type == cc.Layout.Type.GRID) {
                if (startAxis == cc.Layout.AxisDirection.VERTICAL) {
                    this.childrens.sort((a: any, b: any) => {
                        return a.x - b.x;
                    });
                    this.childrens.sort((a: any, b: any) => {
                        return b.y - a.y;
                    });
                } else if (startAxis == cc.Layout.AxisDirection.HORIZONTAL) {
                    this.childrens.sort((a: any, b: any) => {
                        return b.y - a.y;
                    });
                    this.childrens.sort((a: any, b: any) => {
                        return a.x - b.x;
                    });
                }
            }

            this.countListParam();

            //获取第一个item实例需要显示的数据索引
            var startIndex = this.childrens[0]["itemIndex"];

            if (type == cc.Layout.Type.GRID && startAxis == cc.Layout.AxisDirection.VERTICAL) {
                startIndex += (startIndex + this.spawnCount) % this.gridCol;
            } else if (this.type == cc.Layout.Type.GRID && startAxis == cc.Layout.AxisDirection.HORIZONTAL) {
                startIndex += (startIndex + this.spawnCount) % this.gridRow;
            }
            if(startIndex < 0){
                startIndex = 0;
            }

            //getScrollOffset()和scrollToOffset()的x值是相反的
            var offset: cc.Vec2 = this.scrollView.getScrollOffset();
            offset.x = - offset.x;
     
            this.createList(startIndex, offset);
        }
    }


    /**计算列表的各项参数 */
    private countListParam() {
        let dataLen = this.numItems;
        let type = this.type;
        let spaceY = this.layout.spacingY;
        let spaceX = this.layout.spacingX;
        let pdTop = this.layout.paddingTop;
        let pdBottom = this.layout.paddingBottom;
        let pdLeft = this.layout.paddingLeft;
        let pdRight = this.layout.paddingRight;
        let contentHeight = this.layout.node.parent.height;

        if (type == cc.Layout.Type.VERTICAL) {
            this.scrollView.horizontal = false;
            this.scrollView.vertical = true;
            this.layout.node.width = this.layout.node.parent.width;
            this.layout.node.height = dataLen * this.itemHeight + (dataLen - 1) * spaceY + pdTop + pdBottom;
            if (this.layout.node.height <= this.scrollView.node.height && this.lackSlide) {
                this.layout.node.height = this.scrollView.node.height + 1;
            }
            //计算创建的item实例数量，比当前scrollView容器能放下的item数量再加上2个
            this.spawnCount = Math.round(this.scrollView.node.height / (this.itemHeight + spaceY)) + this.prefabNodeNumber;
            //计算bufferZone，item的显示范围
            this.halfScrollView = this.scrollView.node.height / 2 + this.itemHeight / 2 + spaceY;
            this.updateFun = this.updateV;
        } else if (type == cc.Layout.Type.HORIZONTAL) {
            this.scrollView.horizontal = true;
            this.scrollView.vertical = false;
            this.layout.node.width = dataLen * this.itemWidth + (dataLen - 1) * spaceX + pdLeft + pdRight;
            this.layout.node.height = contentHeight;
            this.spawnCount = Math.round(this.scrollView.node.width / (this.itemWidth + spaceX)) + this.prefabNodeNumber;
            this.halfScrollView = this.scrollView.node.width / 2 + this.itemWidth / 2 + spaceX;
            this.updateFun = this.udpateH;
        } else if (type == cc.Layout.Type.GRID) {
            let startAxis = this.layout.startAxis;
            if (startAxis == cc.Layout.AxisDirection.HORIZONTAL) {
                this.scrollView.horizontal = true;
                this.scrollView.vertical = false;
                this.layout.node.height = contentHeight;

                //如果left和right间隔过大，导致放不下一个item，则left和right都设置为0，相当于不生效
                if (pdTop + pdBottom + this.itemHeight + spaceY > this.layout.node.height) {
                    pdTop = pdBottom = 0;
                    this.layout.paddingTop = this.layout.paddingBottom = 0;
                }

                this.gridRow = Math.floor((contentHeight - pdTop - pdBottom) / (this.itemHeight));
                this.gridCol = Math.ceil(dataLen / this.gridRow);
                this.layout.node.width = this.gridCol * this.itemWidth + (this.gridCol - 1) * spaceX + pdLeft + pdRight;
                this.spawnCount = Math.round(this.scrollView.node.width / (this.itemWidth + spaceX)) * this.gridRow + this.gridRow * 2;
                this.halfScrollView = this.scrollView.node.width / 2 + this.itemWidth / 2 + spaceX;
                this.updateFun = this.updateGrid_H;

                if (this.layout.node.width <= this.scrollView.node.width && this.lackSlide) {
                    this.layout.node.width = this.scrollView.node.width + 1;
                }
            } else if (startAxis == cc.Layout.AxisDirection.VERTICAL) {

            }
        }
    }


    /**垂直排列 */
    private updateV() {
        let spaceY = this.layout.spacingY;
        let items = this.childrens;
        let item;
        let bufferZone = this.halfScrollView;
        let isUp = this.scrollView.content.y > this.lastContentPosY;
        let offset = (this.itemHeight + spaceY) * items.length;
        let pdBottom = this.layout.paddingBottom;
        let pdTop = this.layout.paddingTop;
        for (let i = 0; i < items.length; i++) {
            item = items[i];
            let viewPos = this.getPositionInView(item);
            if (isUp) {
                //item上滑时，超出了scrollView上边界，将item移动到下方复用，item移动到下方的位置必须不超过content的下边界
                if (viewPos.y > bufferZone && item.y - offset - pdBottom > -this.layout.node.height) {
                    let itemIndex = item.itemIndex + items.length;
                    if (itemIndex >= this.numItems) {
                        break;
                    }
                    item.itemIndex = itemIndex;
                    item.y = item.y - offset;
                    item.stopAllActions();
                    item.showEnable = false;
                    cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, itemIndex)
                }
            } else {
                //item下滑时，超出了scrollView下边界，将item移动到上方复用，item移动到上方的位置必须不超过content的上边界
                if (viewPos.y < -bufferZone && item.y + offset + pdTop < 0) {
                    let itemIndex = item.itemIndex - items.length;
                    if (itemIndex < 0) {
                        break;
                    }
                    item.itemIndex = itemIndex;
                    item.y = item.y + offset;
                    item.stopAllActions();
                    item.showEnable = false;
                    cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, itemIndex)
                }
            }
        }

        for (let i = 0; i < items.length; i++) {
            item = items[i];
            let viewPos = this.getPositionInView(item);
            if (isUp) {
                //item上滑时, 超出了scrollView上边界
                if (viewPos.y > -bufferZone && !item.showEnable) {
                    let itemIndex = item.itemIndex
                    item.showEnable = true;
                    cc.Component.EventHandler.emitEvents(this.appearEvents, item, itemIndex)
                    break
                }
            } else {
                if (viewPos.y < bufferZone && !item.showEnable) {
                    let itemIndex = item.itemIndex
                    item.showEnable = true;
                    cc.Component.EventHandler.emitEvents(this.appearEvents, item, itemIndex)
                    break
                }
            }
        }

        this.lastContentPosY = this.scrollView.content.y;
    }


    /**水平排列 */
    private udpateH() {
        let spaceX = this.layout.spacingX;
        let items = this.childrens;
        let item;
        let bufferZone = this.halfScrollView;
        let isRight = this.scrollView.content.x > this.lastContentPosX;
        let offset = (this.itemWidth + spaceX) * items.length;
        let pdLeft = this.layout.paddingLeft;
        let pdRight = this.layout.paddingRight;
        for (let i = 0; i < items.length; i++) {
            item = items[i];
            let viewPos = this.getPositionInView(item);
            if (isRight) {
                //item右滑时，超出了scrollView右边界，将item移动到左方复用，item移动到左方的位置必须不超过content的左边界
                if (viewPos.x > bufferZone && item.x - offset - pdLeft > 0) {
                    let itemIndex = item.itemIndex - items.length;
                    item.itemIndex = itemIndex;
                    item.x = item.x - offset;
                    item.stopAllActions();
                    item.showEnable = false
                    cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, itemIndex)
                }
            } else {
                //item左滑时，超出了scrollView左边界，将item移动到右方复用，item移动到右方的位置必须不超过content的右边界
                if (viewPos.x < -bufferZone && item.x + offset + pdRight < this.layout.node.width) {
                    let itemIndex = item.itemIndex + items.length;
                    item.itemIndex = itemIndex;
                    item.x = item.x + offset;
                    item.stopAllActions();
                    item.showEnable = false
                    cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, itemIndex)
                }
            }
        }
        
 
        for (let i = 0; i < items.length; i++) {
            item = items[i];
            let viewPos = this.getPositionInView(item);
            if (isRight) {
                //item上滑时, 超出了scrollView上边界
                if (viewPos.y > -bufferZone && !item.showEnable) {
                    let itemIndex = item.itemIndex
                    item.showEnable = true;
                    cc.Component.EventHandler.emitEvents(this.appearEvents, item, itemIndex,isRight)
                    break
                }
            } else {
                if (viewPos.y < bufferZone && !item.showEnable) {
                    let itemIndex = item.itemIndex
                    item.showEnable = true;
                    cc.Component.EventHandler.emitEvents(this.appearEvents, item, itemIndex,isRight)
                    break
                }
            }
        }

        this.lastContentPosX = this.scrollView.content.x;
    }


    /**网格水平排列 */
    private updateGrid_H() {
        let spaceX = this.layout.spacingX;
        let pdLeft = this.layout.paddingLeft;
        let pdRight = this.layout.paddingRight;
        let items = this.childrens;
        let item;
        let bufferZone = this.halfScrollView;
        let isRight = this.scrollView.content.x > this.lastContentPosX;
        let offset = (this.itemWidth + spaceX) * (this.spawnCount / this.gridRow);
        for (let i = 0; i < items.length; i++) {
            item = items[i];
            let viewPos = this.getPositionInView(item);
            if (isRight) {
                //item右滑时，超出了scrollView右边界，将item移动到左方复用，item移动到左方的位置必须不超过content的左边界
                if (viewPos.x > bufferZone + this.itemWidth / 2 && item.x - offset - pdLeft > 0) {
                    let itemIndex = item.itemIndex - (this.spawnCount / this.gridRow) * this.gridRow;
                    item.itemIndex = itemIndex;
                    item.stopAllActions();
                    item.x = item.x - offset;
                    item.showEnable = false;
                    cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, itemIndex)
                }
            } else {
                //item左滑时，超出了scrollView左边界，将item移动到右方复用，item移动到右方的位置必须不超过content的右边界
                if (viewPos.x < (-bufferZone - this.itemWidth / 2) && item.x + offset + pdRight < this.layout.node.width) {
                    let itemIndex = item.itemIndex + (this.spawnCount / this.gridRow) * this.gridRow;
                    item.x = item.x + offset;
                    item.stopAllActions();
                    item.showEnable = false;
                    item.itemIndex = itemIndex;
                    cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, itemIndex)
                }
            }
        }

        for (let i = 0; i < items.length; i++) {
            item = items[i];
            let viewPos = this.getPositionInView(item);
            if (isRight) {
                //item右滑时, 超出了scrollView左边界
                if (viewPos.x >= -bufferZone - spaceX && !item.showEnable) {
                    let itemIndex = item.itemIndex
                    item.showEnable = true;
                    cc.Component.EventHandler.emitEvents(this.appearEvents, item, itemIndex,isRight)
                }
            } else {
                if (viewPos.x <= bufferZone + spaceX && !item.showEnable) {
                    let itemIndex = item.itemIndex
                    item.showEnable = true;
                    cc.Component.EventHandler.emitEvents(this.appearEvents, item, itemIndex,isRight)
                }
            }
        }
        this.lastContentPosX = this.scrollView.content.x;
    }

    /**获取item在scrollView的局部坐标 */
    private getPositionInView(item) {
        let worldPos = item.parent.convertToWorldSpaceAR(item.position);
        let viewPos = this.scrollView.node.convertToNodeSpaceAR(worldPos);
        return viewPos;
    }

    /**
     * 创建列表 
     * @param startIndex 起始显示的数据索引 0表示第一项
     * @param offset     scrollView偏移量
     */
    private createList(startIndex: number, offset: cc.Vec2) {
        if(startIndex <= 0){
            startIndex = 0;
        }
        //当需要显示的数据长度 > 虚拟列表长度， 删除最末尾几个数据时，列表需要重置位置到scrollView最底端
        if (this.numItems > this.spawnCount && (startIndex + this.spawnCount - 1) >= this.numItems) {
            startIndex = this.numItems - this.spawnCount;
            offset = this.scrollView.getMaxScrollOffset();

            //当需要显示的数据长度 <= 虚拟列表长度， 隐藏多余的虚拟列表项 
        } else if (this.numItems <= this.spawnCount) {
            startIndex = 0;
        }

        for (let i = 0; i < this.spawnCount; i++) {
            let item: any;
            //需要显示的数据索引在数据范围内，则item实例显示出来
            if (i + startIndex < this.numItems) {
                if (this.childrens[i] == null) {
                    item = this.getItem();
                    this.childrens.push(item);
                    item.parent = this.layout.node;
                } else {
                    item = this.childrens[i];
                }
                //需要显示的数据索引超过了数据范围，则item实例隐藏起来
            } else {
                //item实例数量 > 需要显示的数据量
                if (this.childrens.length > (this.numItems - startIndex)) {
                    item = this.childrens.pop();
                    this.removeItem(item);
                }
                continue;
            }

            item.itemIndex = i + startIndex;

            cc.Component.EventHandler.emitEvents(this.refreshItemEvents, item, item.itemIndex)

            let type = this.type;
            let spaceY = this.layout.spacingY;
            let spaceX = this.layout.spacingX;
            let pdTop = this.layout.paddingTop;
            let pdLeft = this.layout.paddingLeft;
            if (type == cc.Layout.Type.VERTICAL) {
                //因为content的锚点X是0，所以item的x值是content.with/2表示居中，锚点Y是1，
                //所以item的y值从content顶部向下是0到负无穷。所以item.y= -item.height/2时，是在content的顶部。
                item.setPosition(0, -item.height * (0.5 + i + startIndex) - spaceY * (i + startIndex) - pdTop);
            } else if (type == cc.Layout.Type.HORIZONTAL) {
                item.setPosition(item.width * (0.5 + i + startIndex) + spaceX * (i + startIndex) + pdLeft, -this.layout.node.height / 2);
            } else if (type == cc.Layout.Type.GRID) {
                let startAxis = this.layout.startAxis;
                if (startAxis == cc.Layout.AxisDirection.HORIZONTAL) {
                    var row = (i + startIndex) % this.gridRow;
                    var col = Math.floor((i + startIndex) / this.gridRow);
                    item.setPosition(item.width * (0.5 + col) + spaceX * col + pdLeft, -item.height * (0.5 + row) - spaceY * row - pdTop);
                }
            }
        }

        this.childrens.forEach((v:any)=>{
            v.showEnable = true;
        })

        this.scrollView.scrollToOffset(offset);

        if(!this.isToltal){
            this.isToltal = true;
            this.scrollView.stopAutoScroll();
            this.scrollView.scrollToOffset(new cc.Vec2(0,0));
            cc.Component.EventHandler.emitEvents(this.dataChangeEvents,this.childrens);
        }
    }

    private isHitScrollView(node: cc.Node) {
        let viewPos = this.getPositionInView(node);
        if (this.type == cc.Layout.Type.VERTICAL) {
            if (viewPos.y > this.halfScrollView || viewPos.y < -this.halfScrollView) {
                return false;
            }
            return true;
        } else if(this.type == cc.Layout.Type.HORIZONTAL){
            if (viewPos.x > this.halfScrollView || viewPos.x < -this.halfScrollView) {
                return false;
            }
            return true;
        } else if(this.type == cc.Layout.Type.GRID){
            if (viewPos.x > this.halfScrollView || viewPos.x < -this.halfScrollView) {
                return false;
            }
            return true;
        }
    }

    /**获取一个列表项 */
    private getItem() {
        let child;
        if (this.poolNode.length) {
            child = this.poolNode.pop();
        } else {
            child = cc.instantiate(this.templateNode);
        }
        child.on(cc.Node.EventType.TOUCH_END, this.itemClickCallback, this);
        return child;
    }

    private removeItem(item){
        if(!item){return}
        item.off(cc.Node.EventType.TOUCH_END, this.itemClickCallback, this);
        item.removeFromParent();
        this.poolNode.push(item);
    }

    //通知所有显示节点 选中节点
    private itemClickCallback(event: cc.Event) {
        let targetIndex = event.target['itemIndex'];
        this._selectedId = targetIndex;
        this.childrens.forEach((node) => {
            let index = node['itemIndex'];
            let checked = targetIndex == index;
            cc.Component.EventHandler.emitEvents(this.clickItemEvents, node, node['itemIndex'], checked, true);
        });
    }

    private onScrolling() {
        this.bScrolling = true;
    }

    private bounceScrolling(target:cc.ScrollView,scrollType:cc.ScrollView.EventType){
        if(scrollType <= cc.ScrollView.EventType.SCROLLING || scrollType >= cc.ScrollView.EventType.SCROLL_ENDED){
            return
        }
        if(scrollType == cc.ScrollView.EventType.BOUNCE_RIGHT){
            let horizontal = this.scrollView.horizontal;
            if(!horizontal){
                return
            }
            let startAxis = this.layout.startAxis;
            if(startAxis != cc.Layout.AxisDirection.HORIZONTAL){
                return
            }
            let horizontalDirection = this.layout.horizontalDirection;
            if(horizontalDirection != cc.Layout.HorizontalDirection.LEFT_TO_RIGHT){
                return
            }
            cc.Component.EventHandler.emitEvents(this.scrollBoundaryEvents);
        }
        
    }

    scrollToIndex(index) {
        if (this.type == cc.Layout.Type.VERTICAL) {
            let spaceY = this.layout.spacingY;
            let pdTop = this.layout.paddingTop;
            let offset = (this.itemHeight + spaceY) * index + pdTop;
            this.scrollView.scrollToOffset(new cc.Vec2(0, offset), 0.5)
        }
    }

    update(dt) {
        if (this.bScrolling == false) {
            return;
        }
        this.updateTimer += dt;
        if (this.updateTimer < this.updateInterval) {
            return;
        }
        this.updateTimer = 0;
        this.bScrolling = false;
        this.updateFun();
    }


    //事件销毁
    onDestroy() {
        this.poolNode.forEach((node) => {
            node.off(cc.Node.EventType.TOUCH_END, this.itemClickCallback, this);
        })
        this.poolNode.length = 0;
        this.childrens.forEach((node) => {
            node.off(cc.Node.EventType.TOUCH_END, this.itemClickCallback, this);
        })
        this.childrens.length = 0;

        //this.scrollView.node.off("scrolling", this.onScrolling, this);
    }
}