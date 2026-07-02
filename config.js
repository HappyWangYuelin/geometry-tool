//_________________________________________________________________________________________________________
//=================================================一些全局常量、变量和全局配置===============================
//_________________________________________________________________________________________________________

import * as sh from './geometry_shapes.js'

//常量
export const INF = 1e5;
//用于缩放
export const SCALE = 1.2;
//程序常用 DOM 对象
export const paintArea = document.getElementById("paint-area");
export const aside = document.getElementsByTagName("aside")[0];
export const asideContent = document.getElementById("aside-content");
export const board = document.getElementById("board");
export const editSide = document.getElementById("edit-mode");
//用于显示和隐藏侧边栏
export const ASIDE_CONTENT = aside.innerHTML;
//用于拖动画布
export var draginfo = {
    dragging: false,
    mouseStart: [0,0],
    moved: false,//判断到底是拖动还是点击
    MOVE_THRESHOLD: 5,//移动超过几像素算作移动而不算作点击
    lastPos: [0, 0]
};
// 是否只是在调整点的位置（防止误添加点）
// export var justMovingPoints = false;
//用于调整画布尺寸
export var canvasinfo = {
    topLeftX : - window.innerWidth / 2,
    topLeftY : - window.innerHeight / 2,
    width : window.innerWidth,
    befWidth : window.innerWidth,
    height : window.innerHeight,
    befHeight : window.innerHeight
};
//每隔多少秒将所有的元素位置重新更新
export const UPD_TIMEOUT = 10;
//用于对选择过的几何元素进行存储
export var choosed = [];
//可以对各种几何图形进行选中的操作模式数组
export const POINT_CAN_CHOOSE = ["create-line-seg", "create-clockwise-arc", "create-circle", "create-midpoint",
    "create-ray", "create-straight-line", "edit"];//可以对点进行选中的操作模式
export const OPERATE_FUNCTIONS = {//对于每个需要选中元素的操作，定义选中的数量和对应的处理函数
    "create-line-seg": [2, () => new sh.LineSeg(...choosed)],//对 create-lines 操作，在选中超过两个点时，创建一条新线段
    "create-clockwise-arc": [3, () => new sh.Arc(...choosed, `弧${choosed[1].name.substr(1) + choosed[2].name.substr(1)}`,
        `以${choosed[0].name}为中心，从${choosed[1].name}到${choosed[2].name}的弧`)],
    "create-circle" : [2, () => new sh.CenterAndPointCircle(...choosed)],
    "create-midpoint": [2, () => new sh.Point(0, 0/* 这里直接用 0 是因为作为中点，初始化时会自动更新 */, {
            restrictType: "midpoint",
            connectEle: choosed.slice()
        })],
    "create-ray": [2, () => new sh.Ray(...choosed)],
    "create-straight-line": [2, () => new sh.StraightLine(...choosed)],
    "edit": [1, () => location.hash = "style-setting-title-" + choosed[0].name]
}
//全局操作类型
export var operate = "create-points";
/*操作的值包括：
edit 对元素进行编辑
create-circle 圆（圆心+圆上一点）
create-points 描点
create-line-seg 连线（线段）
create-clockwise-arc 绘制顺时针圆弧
create-midpoint 中点
create-ray 射线
create-straight-line 直线
*/
// 切换操作类型的函数
export function setOperate(newOp) {
    let oldOp = operate;
    operate = newOp;
    choosed.forEach((value, index, array) => value.cancelActive());
    choosed = [];
    if(newOp != 'change-mode') return;//接下来是切换模式的特殊操作
    if (oldOp == "edit") {
        operate = 'create-points';
        document.getElementById("create-mode").style.display = "inline";
        document.getElementById("edit-mode").style.display = "none";
        document.getElementById("change-mode-button").innerHTML = "编辑";
    } else {
        operate = 'edit';
        document.getElementById("create-mode").style.display = "none";
        document.getElementById("edit-mode").style.display = "inline";
        document.getElementById("change-mode-button").innerHTML = "创建";
    }
}

// 在样式设置场景下，类名对应标题（比如，Point 类的样式修改对应标题“点”）
export const SHAPENAME = {
    "Point": "点",
    "Line": "线图形",
    "Arc": "线图形",
    "Circle": "线图形"
}
