const { ccclass, property, disallowMultiple, menu, requireComponent } = cc._decorator;
@ccclass
@disallowMultiple()
@menu('Saas组件/SaasEditorBox')
@requireComponent(cc.EditBox)
export default class SaasEditorBox extends cc.Component {
    @property({
        tooltip:CC_DEV&&'清除功能是否启用',
    })
    private ClearEnable: boolean = false;

    @property({
        tooltip:CC_DEV&&'眼睛功能是否启用',
    })
    private EyeEnable:boolean = false;

    @property({ type: cc.Sprite, tooltip: CC_DEV && '选中背景' })
    private SelectedBackground: cc.Sprite = null;

    //清空节点
    @property({
        type: cc.Node, tooltip: CC_DEV && '清除内容按钮',
        visible() {
            return this.ClearShow;
        },
    })
    private ClearContent: cc.Node = null;

    @property
    private _ClearShow: boolean = false;
    @property({ tooltip: CC_DEV && '激活清空按钮' })
    get ClearShow(): boolean {
        return this._ClearShow;
    }
    set ClearShow(value) {
        this._ClearShow = value;
        this.ClearContent.active = value;
        this._ShowEye = false;
        this.EyeContent.active = false;
    }


    //密码眼睛节点
    @property({
        type: cc.Node, tooltip: CC_DEV && '清除眼睛按钮',
        visible() {
            return this.ShowEye;
        },
    })
    private EyeContent: cc.Node = null;
    private _ShowEye: boolean = false;
    @property({ tooltip: CC_DEV && '激活眼睛按钮' })
    public get ShowEye(): boolean {
        return this._ShowEye;
    }
    public set ShowEye(v: boolean) {
        this._ShowEye = v;
        this.EyeContent.active = v;
        this._ClearShow = false;
        this.ClearContent.active = false;
    }



    @property({
        type:cc.Sprite,
        tooltip:CC_DEV && '眼睛资源',
        visible(){
            return this.ShowEye;
        }
    })
    private EyeSprite:cc.Sprite = null;

    @property({
        type: cc.SpriteFrame,
        tooltip:CC_DEV && '睁开眼睛图片',
        visible() {
            return this.ShowEye;
        },
    })
    private openEyeFrame:cc.SpriteFrame = null;
    @property({
        type: cc.SpriteFrame,
        tooltip:CC_DEV && '闭上眼睛图片',
        visible() {
            return this.ShowEye;
        },
    })
    private closeEyeFrame:cc.SpriteFrame = null;
    private _eyeState:boolean = false;
    @property({
        tooltip:CC_DEV && '默认眼睛状态 true睁眼 false闭眼',
    })
    public get eyeState() : boolean {
        return this._eyeState;
    }
    public set eyeState(v : boolean) {
        this._eyeState = v;
        if(v){
            if(this.EyeSprite){
                this.openEyeFrame && (this.EyeSprite.spriteFrame = this.openEyeFrame);
                if(this.editorBox["oldInputFlag"] && this.editorBox){
                    this.editorBox && (this.editorBox.inputFlag = this.editorBox["oldInputFlag"]);
                }
            }
        }else{
            if(this.EyeSprite){
                this.closeEyeFrame && (this.EyeSprite.spriteFrame = this.closeEyeFrame);
                if(!this.editorBox["oldInputFlag"] && this.editorBox){
                    this.editorBox["oldInputFlag"] = this.editorBox.inputFlag;
                }
                this.editorBox && (this.editorBox.inputFlag = cc.EditBox.InputFlag.PASSWORD);
            }
        }
    }

    

    public get string() : string {
        return this.editorBox.string;
    }
    public set string(v : string) {
        this.editorBox.string = v;
        this.editingChanged();
    }
    
    
    

    //输入框
    public _editorBox: cc.EditBox;
    get editorBox () {
        return this.node.getComponent(cc.EditBox);
    }


    onLoad() {
        // this.editorBox = this.node.getComponent(cc.EditBox);
        this.node.on('editing-did-began', this.editingDidBegan, this);
        this.node.on('editing-did-ended', this.editingReturn, this);
        this.node.on('text-changed', this.editingChanged, this);
    }

    start(){
        this.editingChanged();
        this.EyeEnable && (this.eyeState = this.eyeState);
    }

    /**
     * 激活输入控件框
     */
    private editingDidBegan() {
        this.SelectedBackground.node.active = true;
    }

    /**
     * 退出输入控件框
     */
    private editingReturn() {
        this.SelectedBackground.node.active = false;
    }

    /**
     * 内容改变
     */
    private editingChanged() {
        if (this.ClearEnable) {
            if (this.editorBox.string && this.editorBox.string.length > 0) {
                this.ClearContent.active = true;
            } else {
                this.ClearContent.active = false;
            }
        }
    }


    /**
     * 清空输入内容
     */
    public clearContent() {
        // if(!this.editorBox){
        //     this.editorBox = this.node.getComponent(cc.EditBox);
        // }

        if(!this.editorBox){
            return
        }
        this.editorBox.string = "";
        this.ClearContent.active = false;
    }


    /**
     * 眼睛状态切换
     */
    private cutEyeState(){
        this.eyeState = !this.eyeState;
    }

    onDestroy() {
        this.node.off('editing-did-began', this.editingDidBegan, this);
        this.node.off('editing-did-ended', this.editingReturn, this);
        this.node.off('text-changed', this.editingChanged, this);
    }
}