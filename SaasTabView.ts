import ScollerViewInner from "../Widget/ScollerViewInner";


const { ccclass, property, disallowMultiple, menu } = cc._decorator;
@ccclass
@disallowMultiple()
@menu('Saas组件/SaasTabView')
export default class SaasTabView extends cc.Component {

    @property({ type: cc.Prefab, tooltip: CC_DEV && '模板节点' })
    private templateNode: cc.Prefab = null;

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '节点刷新函数' })
    refreshItemEvents: cc.Component.EventHandler[] = [];

    @property({ type: [cc.Component.EventHandler], tooltip: CC_DEV && '节点点击函数' })
    clickItemEvents: cc.Component.EventHandler[] = [];

    @property({ type: cc.Component.EventHandler, tooltip: CC_DEV && '节点初始化函数' })
    initItemEvent: cc.Component.EventHandler = new cc.Component.EventHandler();

    @property({type:cc.Component.EventHandler,tooltip: CC_DEV && '节点动画'})
    animtionEvent: cc.Component.EventHandler = new cc.Component.EventHandler();

    public get view(): cc.Node { return this.scrollView['_view'] }
    //节点宽度
    private itemWidth:number = 0;

    //toggle容器
    public scrollView: any;
    //对象池
    private poolNode: cc.Node[] = [];
    //本地节点
    private childrens: cc.Node[] = [];
    //节点个数
    private _numItems: number;
    public get numItems(): number {
        return this._numItems;
    }
    public set numItems(v: number) {
        this._selectedId = -1;
        if (v == this._numItems) {
            //通知所有节点刷新
            this.childrens.forEach((node, index) => {
                cc.Component.EventHandler.emitEvents([this.initItemEvent],node,node['index']);
                cc.Component.EventHandler.emitEvents(this.refreshItemEvents, node, node['index'])
            })
            cc.Component.EventHandler.emitEvents([this.animtionEvent],this.childrens)
            return
        }
        this.createItems(v);
        this._numItems = v;
        cc.Component.EventHandler.emitEvents([this.animtionEvent],this.childrens)
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
            let index = node['index'];
            let checked = this._selectedId == index;
            cc.Component.EventHandler.emitEvents(this.clickItemEvents, node, node['index'], checked);
        });
    }

    onLoad() {
        this.scrollView = this.node.getComponent(ScollerViewInner);
        if(!this.scrollView){
            this.scrollView = this.node.getComponent(cc.ScrollView);
        }
    }

    //创建节点
    private createItems(value: number) {
        this.removeChilds(value);
        let total = value - this.scrollView.content.children.length //计算当前应该创建的总数
        for (let i = 0; i < total; ++i) {
            let child = this.getChild();
            child['index'] = this.scrollView.content.childrenCount;
            this.scrollView.content.addChild(child);
            this.childrens.push(child);
            
        }
        //通知所有节点刷新
        this.childrens.forEach((child,index)=>{
            cc.Component.EventHandler.emitEvents([this.initItemEvent],child,child['index']);
            cc.Component.EventHandler.emitEvents(this.refreshItemEvents, child, child['index'])
        })
        this.scrollView.content.width = value * this.itemWidth;
    }

    /** 删除多余的item */
    private removeChilds(value: number) {
        // 有多余的item 需要删除
        let length = this.scrollView.content.children.length;
        // 删除掉多余的item
        for (let i = 0; i < length; i++) {
            let child = this.childrens.pop();
            this.scrollView.content.removeChild(child);
            this.poolNode.push(child);
            child.off(cc.Node.EventType.TOUCH_END, this.itemClickCallback, this);
            let nAny:any = child;
            if (nAny._tween) {
                nAny._tween.stop();
                nAny._tween = null;
            }
        }
    }

    /** 对象池获取item */
    private getChild(): cc.Node {
        let child
        if (this.poolNode.length) {
            child = this.poolNode.pop();
        }else{
            child = cc.instantiate(this.templateNode);
            if(!this.itemWidth){
                this.itemWidth = child.width;
            }
        }
        child.on(cc.Node.EventType.TOUCH_END, this.itemClickCallback, this);
        return child;
    }

    //通知所有显示节点 选中节点
    private itemClickCallback(event: cc.Event) {
        let targetIndex = event.target['index'];
        this.itemClick(targetIndex);
    }

    //通知节点选中
    private itemClick(targetIndex:number){
        if(targetIndex < 0 || targetIndex>= this.childrens.length){
            return
        }
        this._selectedId = targetIndex;
        this.childrens.forEach((node) => {
            let index = node['index'];
            let checked = targetIndex == index;
            cc.Component.EventHandler.emitEvents(this.clickItemEvents, node, node['index'], checked);
        });
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
    }
}