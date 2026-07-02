/*
本程序用于设置几何元素的外观，一下是一些定义的函数和类：
export class StyleSetting
    static configBaseSettings() 配置最基础的大类属性设置组件（如点整体的设置，线图形整体的设置）
    constructor(obj_list, form, name, eleMeaning)
        obj_list 代表关联的 HTML 对象列表（即：用该对象修改后有哪些元素会被改变）
        form 代表表单的 HTML 对象（此时表单还没有进入 HTML DOM 树中）
        name 代表该对象的名称，作为 settings 中的键
        eleMeaning 是一个对象，有两层，第一层是 HTML 元素 StyleConfig 的名称，第二层代表每一个表单元素的 name 对应什么样式名。
                    一般而言，样式名会在更新后被设为表单元素的 value 值。但是如果是 checkbox，则需要在值的后面用空格再加两部分代表 checked 和 !checked 时的值
                e.g. {
                    activeConfig : {
                        'display-choice': 'visibility visible hidden',// checkbox 特殊情况 
                        'fillcolor-input': 'fillColor',
                        'input-2': 'backgroundColor'
                    },
                    normalConfig: {
                        'input-3': 'fontFamily',
                        'input-4': 'color'
                    }
                }
        该函数会创建一个表单并将其直接插入到父元素的最后一个子节点，且带有标题，name 属性即为标题的 id
    add_obj(obj) / delete_obj(obj)
        添加/删除元素
    destroy()
        删除样式设置对象前**必须**先调用此函数，否则 HTML 里会消不掉
*/
import * as cnf from './config.js'
import * as sh from './geometry_shapes.js'
import * as tls from './tools.js'

export const PRESET_STYLES = {
    "点": {
        "默认": {
            "circle-display": true,
            "circle-fillcolor": "#FF0000",
            "circle-bordercolor": "#000000",
            "circle-display-active": true,
            "circle-fillcolor-active": "#FF0000",
            "circle-bordercolor-active": "#FFFF00",
            "text-display": true,
            "text-font": "Microsoft YaHei",
            "text-color": "#000000"
        }
    }
}
export const DEFAULT_CSS_STYLES = {
    "点": {
        normalPoint: {
            stroke: "#000000",
            fill: "#FF0000",
            visibility: "visible"
        },
        activePoint: {
            stroke: "#FFFF00",
            fill: "#FF0000",
            visibility: "visible"
        },
        pointName: {
            fill:"#000000",
            userSelect: "none",
            webkitUserSelect: "none",
            visibility: "visible",
            fontFamily: "Arial, Helvetica, sans-serif"
        }
    },
    "线图形": {
        normalShape: {
            stroke: "#000000",
            fill: "none"
        }
    }
}

// 对每种图形类配置样式的 HTML 表单的 innerHTML 以及进行样式更新的函数
// 见文件开头对于 class StyleSetting constructor() 的描述
// 事实上，下面对象中的 inner 即为参数中 form 的 innerHTML（不包含 <form> 标签）
//（inner 要求必须有一个 <input type="text"/>，它的 name="preset"，代表默认样式选择器）
// eleMeaning 即为 eleMeaning
// 由于 id 不能重复的问题，inner 里使用 $ 号来代表当前是第几个表单，这样每个表单之间必然 id 互不重复
// 比如，实际上 JS 加入 DOM 树时将 $ 替换为 style-form-1 之类的东西
function updateForm(formEle, obj) {//按照 obj 中 name 和 checked/value 对应的内容对表单进行修改
    for(let key in obj) {
        let ele = formEle[key];
        if(ele.type === "checkbox") ele.checked = obj[key];
        else ele.value = obj[key];
    }
}
const STYLE_FORM = {
    "点": {
        inner: `
    <label class="control" for="$-preset"><strong>预设样式</strong></label>
    <input class="control" id="$-preset" type="text" list="$-preset-datalist" name="preset" value="默认"/>
    <datalist class="control" id="$-preset-datalist"><!-- 预设样式 -->
    <option value="默认">默认（内红外黑）</option>
        
    </datalist><br/>

    <label class="control" for="$-div-opener-1"><strong>圆圈样式</strong></label><br/>
    <input type="checkbox" class="div-opener" id="$-div-opener-1"/>
    <div>
      <input type="checkbox" id="$-circle-display" name="circle-display" class="control" checked/>
      <label for="$-circle-display" class="control">显示圆圈</label><br/>

      <label for="$-circle-fillcolor" class="control">填充色</label>
      <input type="color" id="$-circle-fillcolor" name="circle-fillcolor" class="control" value="#FF0000"/>
      <br/>
      <label for="$-circle-bordercolor"class="control">边框色</label>
      <input type="color" id="$-circle-bordercolor" name="circle-bordercolor" class="control" value="#000000"/>
    </div>

    <label class="control" for="$-div-opener-2"><strong>选中时圆圈样式</strong></label><br/>
    <input type="checkbox" class="div-opener" id="$-div-opener-2"/>
    <div>
      <input type="checkbox" id="$-circle-display-active" name="circle-display-active" class="control" checked/>
      <label for="$-circle-display-active" class="control">显示圆圈</label><br/>

      <label for="$-circle-fillcolor-active" class="control">填充色</label>
      <input type="color" id="$-circle-fillcolor-active" name="circle-fillcolor-active" class="control" value="#FF0000"/>
      <br/>
      <label for="$-circle-bordercolor-active" class="control">边框色</label>
      <input type="color" id="$-circle-bordercolor-active" name="circle-bordercolor-active" class="control" value="#FFFF00"/>
    </div>
        
    <label class="control" for="$-div-opener-3"><strong>点名称的样式</strong></label><br/>
    <input type="checkbox" class="div-opener" id="$-div-opener-3"/>
    <div>
      <input type="checkbox" id="$-text-display" name="text-display" class="control" checked/>
      <label for="$-text-display" class="control">显示点的名称</label><br/>

      <label for="$-text-font"class="control">字体</label>
      <input type="text" id="$-text-font" name="text-font" list="$-textfont-datalist" class="control" value="Arial, Helvetica, sans-serif"/>
      <datalist class="control" id="$-textfont-datalist">
        <option value="Arial, Helvetica, sans-serif">Arial（默认）</option>
        <option value="'Times New Roman', Times, serif">Times New Roman（有衬线，几何常用）</option>
      </datalist>
      <br/>
      <label for="$-circle-bordercolor" class="control">颜色</label>
      <input type="color" id="$-text-color" name="text-color" class="control" value="#000000"/>
      <br/>
    </div>

    <input type="submit" value="确认" class="control"/>
    `,
        eleMeaning: {
            normalPoint: {
                "circle-display": "visibility visible hidden",
                "circle-fillcolor": "fill",
                "circle-bordercolor": "stroke"
            },
            activePoint: {
                "circle-display-active": "visibility visible hidden",
                "circle-fillcolor-active": "fill",
                "circle-bordercolor-active": "stroke"
            },
            pointName: {
                "text-display": "visibility visible hidden",
                "text-font": "fontFamily",
                "text-color": "fill"
            }
        }
    },
    "线图形": {
        inner: `
    <label class="control" for="$-preset"><strong>预设样式</strong></label>
    <input class="control" id="$-preset" type="text" list="$-preset-datalist" name="preset" value="默认"/>
    <datalist class="control" id="$-preset-datalist"><!-- 预设样式 -->
    <option value="默认">默认样式</option>
                
    </datalist><br/>
    <label class="control" for="$-div-opener-1"><strong>线的样式</strong></label>
    <input type="checkbox" class="div-opener" id="$-div-opener-1"/>
    <div><!-- 正常情况下的样式 -->
    <input id="$-line-display" class="control" type="checkbox" name="line-display" checked/>
    <label for="$-line-display" class="control">显示形状</label><br/>
    <label for="$-line-color" class="control">颜色</label>
    <input type="color" class="control" id="$-line-color" name="line-color" value="#000000"/>
    </div>

    
    <input type="submit" value="确认" class="control"/>
    `,
        eleMeaning: {
            normalShape: {
                "line-display": "visibility visible hidden",
                "line-color": "stroke"
            }
        }
    }
}
export function newStyleForm(shapeType, idx) {
    // 返回一个 shapeType 类型图形的样式配置 form 元素
    let formStr = STYLE_FORM[shapeType].inner;
    let res = document.createElement("form");
    let prefix = `style-form-${idx}`;
    res.innerHTML = formStr.replaceAll("$", prefix);
    res.className = "control";
    res.setAttribute("data-shapeType", shapeType);
    // 绑定事件（在切换预设样式时对下面的选项进行同步更新）
    let defaultStyleSetter = (event) => {
        let changeTo = {}, form = event.currentTarget.closest("form");
        let shapeType = form.getAttribute("data-shapeType");
        let presetName = form["preset"].value;
        for(let key in PRESET_STYLES[shapeType]){
            if(key === presetName) {
                changeTo = PRESET_STYLES[shapeType][key];
                break;
            }
        }
        updateForm(form, changeTo);
    };
    res["preset"].addEventListener("click", defaultStyleSetter);
    res["preset"].addEventListener("input", defaultStyleSetter);
    return res;
}
export class StyleConfig {
    constructor(htmlEle, initStyle, using){
        this.htmlEle = htmlEle;
        this.styleNow = initStyle;
        this.using = using;// 是否正在使用该样式
        this.updateStyle();
    }
    updateStyle() {
        if(this.using) for(let k in this.styleNow) {
            this.htmlEle.style[k] = this.styleNow[k];
        }
    }
    configOrDelete() {// 配置或退出该样式
        this.using = !this.using; this.updateStyle();
    }
    changeStyle(changeTo) {
        for(let key in changeTo)
            this.styleNow[key] = changeTo[key];
        this.updateStyle();
    }
}
export class StyleSetting {
    static settings = {};//所有的样式设置对象组成的对象（key 是 name，value 是对象）
    static idx = 0;
    static configBaseSettings() {
        new StyleSetting([], newStyleForm("点", ++StyleSetting.idx), "点", STYLE_FORM["点"].eleMeaning);
        new StyleSetting([], newStyleForm("线图形", ++StyleSetting.idx), "线图形", STYLE_FORM["线图形"].eleMeaning);
    }
    constructor(obj_list, form, name, eleMeaning){
        this.obj_list = obj_list;
        this.eleMeaning = eleMeaning;
        this.focusWithin = false;

        this.formTitle = document.createElement("div");// 容纳标题和链接的容器
        var para = Object.assign(document.createElement("p"), {
            innerHTML: name,
            className: "control",
            id: "style-setting-title-" + name
        });
        para.style.display = "inline";
        this.formTitle.appendChild(para);

        if(obj_list.length === 1){
            var link = Object.assign(document.createElement("a"), {
                className: "style-setting-link",
                href: "#style-setting-title-" + cnf.SHAPENAME[obj_list[0].shapeType.name],
                innerHTML: "#" + cnf.SHAPENAME[obj_list[0].shapeType.name]
            });
            this.formTitle.appendChild(link);
        }

        cnf.editSide.appendChild(this.formTitle);

        this.form = form;
        this.form.onsubmit = () => {
            for(let ele of this.obj_list)
               this.update(ele);
            return false;
        }
        document.addEventListener("focusin", (event) => {
            this.focusWithin = this.form.contains(event.target);
        });
        setInterval(() => {if(!this.focusWithin) this.updateSelf();}, cnf.UPD_TIMEOUT);
        cnf.editSide.appendChild(this.form);

        StyleSetting.settings[name] = this;
    }
    update(obj) {// 用自己表单的数据更新元素的 StyleConfig 的数据
        for(let key in this.eleMeaning) {
            let styCnf = obj.styles[key], meaning = this.eleMeaning[key];
            let changeTo = {};
            for(let opt in meaning) {
                let tmp = meaning[opt].split(" ");
                if(tmp.length == 1) changeTo[tmp[0]] = this.form[opt].value;
                else changeTo[tmp[0]] = this.form[opt].checked ? tmp[1] : tmp[2];// checkbox 特殊情况
            }
            styCnf.changeStyle(changeTo);
        }
    }
    updateSelf() {// 根据第一个关联元素的 StyleConfig 的数据同步自己的
        if(this.obj_list.length === 0) return;
        let obj = this.obj_list[0];
        for(let key in this.eleMeaning) {
            let styCnf = obj.styles[key], meaning = this.eleMeaning[key];
            let changeTo = {};
            for(let opt in meaning) {
                let tmp = meaning[opt].split(" ");
                if(tmp.length == 1) this.form[opt].value = styCnf.styleNow[tmp[0]];
                else this.form[opt].checked = styCnf.styleNow[tmp[0]] == tmp[1];
            }
            updateForm(this.form, changeTo);
        }
    }
    add_obj(obj){
        this.obj_list.push(obj);
        /*if(this.obj_list.length > 1)*/this.update(obj);
        //else this.updateSelf();
    }
    delete_obj(obj){
        this.obj_list.splice(this.obj_list.indexOf(obj), 1);
    }
    destroy(){
        this.form.remove();
        this.formTitle.remove();
    }
}
export function addStyleSettingFor(obj) {
    let name = obj.shapeType.name;
    let shapeType = cnf.SHAPENAME[name];
    new StyleSetting([obj], newStyleForm(shapeType, ++StyleSetting.idx), obj.name, STYLE_FORM[shapeType].eleMeaning);
    StyleSetting.settings[shapeType].add_obj(obj);
}