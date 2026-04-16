/*
开发备忘：
1、本程序采用以 Shape 为基类，来继承出其它图形类的方式来设计，其中基类已经实现了 wheel 和 updateAll 方法，
   并会在调整大小时自动调用 wheel，异步自动不断 updateAll。所以在开发子类时，需要实现 updateAll 和 wheel 方法，
   以便 Shape 类进行调用。而在子类的代码中，由于 Shape 类已经自动 updateAll 了，所以不需要 this.update，除了
   初始化时需要（详见第二条）。
2、程序类继承链：
   Shape 基类 | 图形子类 | 图形构造子类
   Shape
   |___Point
   |___Line
   |   |____LineSeg
   |   |____Ray
   |   |____StraightLine
   |___Circle
   |   |___CenterAndPointCircle
   |___Arc

    对于图形子类继承自 Shape 基类的细则见第一条。
    对于图形子类，其基本格式如下：

class [类名] extends Shape {
    static [存实例用的数组名] = [];
    static wheel(scale) {
        //必须实现
    }
    static updateAll() {
        for(let i of [类名].[存实例用的数组])
            i.update();
    }
    [一些其它的静态属性和方法]
    constructor([一些参数]) {
        super([几何元素名称], [元素信息（discription）]);
        [一些基本的参数设置]
        this.[用来存对应的 SVG 对象的属性] = createSVG([SVG 标签名]);
        [类名].[存实例用的数组名].push(this);
        this.update("init");

        paintArea.prepend(this.[用来存对应的 SVG 对象的属性]);
        [类名].[存实例用的数组名].push(this);
    }
    update() {
        //必须实现
    }
}

    对于图形构造子类，其基本格式如下：

class [类名] extends [父类] {
    [一些静态属性和方法]
    constructor([一些参数]) {
        super([一些参数]);//上下文初始化
        this.[属性1] = [值1];//赋值子类特有属性
        this.[属性2] = [值2]；
        ...
    }
    update(type) {
        if(type !== "init") {
            [一些需要用到子类属性的操作]
            //父类 constructor 中会调用子类的 update，并会传参 "init"，让子类进行判断，
            //以便防止读取一些子类独有的属性（因为当时还没有设置）
        }
        super.update();
    }
}

*/

//*********************************  一些全局常量和变量  *********************************
//常量
var INF = 1e5;
//用于缩放
const SCALE = 1.2;
//程序常用 DOM 对象
var paintArea = document.getElementById("paint-area");
var aside = document.getElementsByTagName("aside")[0];
//用于显示和隐藏侧边栏
const ASIDE_CONTENT = aside.innerHTML;
//用于拖动画布
var draginfo = {
    dragging: false,
    mouseStart: [0,0],
    moved: false,//判断到底是拖动还是点击
    MOVE_THRESHOLD: 5,//移动超过几像素算作移动而不算作点击
    lastPos: [0, 0]
};
//是否只是在调整点的位置（防止误添加点）
var justMovingPoints = false;
//用于调整画布尺寸
var canvasinfo = {
    topLeftX : - window.innerWidth / 2,
    topLeftY : - window.innerHeight / 2,
    width : window.innerWidth,
    befWidth : window.innerWidth,
    height : window.innerHeight,
    befHeight : window.innerHeight
};
//每隔多少秒将所有的元素位置重新更新
const UPD_TIMEOUT = 10;
//吸附操作的阈值
var nearThreshold = 5;
//用于对选择过的几何元素进行存储
var choosed = [];
//可以对各种几何图形进行选中的操作模式数组
const POINT_CAN_CHOOSE = ["create-line-seg", "create-clockwise-arc", "create-circle", "create-midpoint",
    "create-ray", "create-straight-line"];//可以对点进行选中的操作模式
const OPERATE_FUNCTIONS = {//对于每个需要选中元素的操作，定义选中的数量和对应的处理函数
    "create-line-seg": [2, () => new LineSeg(...choosed)],//对 create-lines 操作，在选中超过两个点时，创建一条新线段
    "create-clockwise-arc": [3, () => new Arc(...choosed, `弧${choosed[1].name.substr(1) + choosed[2].name.substr(1)}`,
        `以${choosed[0].name}为中心，从${choosed[1].name}到${choosed[2].name}的弧`)],
    "create-circle" : [2, () => new CenterAndPointCircle(...choosed)],
    "create-midpoint": [2, () => new Point(0, 0/* 这里直接用 0 是因为作为中点，初始化时会自动更新 */, {
            restrictType: "midpoint",
            connectEle: choosed.slice()
        })],
    "create-ray": [2, () => new Ray(...choosed)],
    "create-straight-line": [2, () => new StraightLine(...choosed)]
}
//全局操作类型
var operate = "create-points";
/*操作的值包括：
edit 对元素进行编辑（暂未编好）
create-circle 圆（圆心+圆上一点）
create-points 描点
create-line-seg 连线（线段）
create-clockwise-arc 绘制顺时针圆弧
create-midpoint 中点
create-ray 射线
create-straight-line 直线
*/
//切换操作类型的函数
function setOperate(newOp) {
    let oldOp = operate;
    operate = newOp;
    choosed.forEach((value, index, array) => value.cancelActive());
    choosed = [];
    if(operate == "edit") {
        document.getElementById("create-mode").style.display = "none";
        document.getElementById("edit-mode").style.display = "inline";
        document.getElementById("change-mode-button").innerHTML = "创建";
    } else if (oldOp == "edit") {
        document.getElementById("create-mode").style.display = "inline";
        document.getElementById("edit-mode").style.display = "none";
        document.getElementById("change-mode-button").innerHTML = "编辑";
    }
}
//当选择几何元素时，对已选择的数量进行判断，从而进行诸如连线等的处理
function raiseEvent() {//对此时的 choosed 数组进行处理，根据是否选了足够的元素来判断执行对应的操作
    if(choosed.length >= OPERATE_FUNCTIONS[operate][0]) {
       OPERATE_FUNCTIONS[operate][1]();
       choosed.forEach((value, index, array) => value.cancelActive());
       choosed = [];
    }
}
//转换屏幕坐标系到 SVG 坐标系的函数
function pxToSVG(px, what) {
    if(what == "x") return canvasinfo.topLeftX + px / window.innerWidth * canvasinfo.width;
    else if(what == "y") return canvasinfo.topLeftY + px / window.innerHeight * canvasinfo.height;
}
function getTheNearest(a, b, ele) {//获取几何元素 ele 距离 (a, b) 最近的点
    if(ele instanceof Point) return [ele.x, ele.y];//点到点
    else if(ele instanceof Line) {//点到线
        let x1 = ele.x1, y1 = ele.y1;
        let x2 = ele.x2, y2 = ele.y2;
        if(x1 > x2) [x1, y1, x2, y2] = [x2, y2, x1, y1];//保证 x1 <= x2
        let dx = x2 - x1, dy = y2 - y1;
        let t = ((a-x1) * dx + (b-y1) * dy) / (dx**2 + dy**2);
        let resx = x1 + t*dx, resy = y1 + t*dy;
        //return [resx, resy];
        if(x1 == x2) {
            let maxy = Math.max(y1, y2), miny = Math.min(y1, y2);
            if(resy > maxy) return [x1, maxy];
            else if(resy < miny) return [x1, miny];
            else return [resx, resy];
        } else {
            if(resx < x1) return [x1, y1];
            else if(resx > x2) return [x2, y2];
            else return [resx, resy];
        }
    } else if(ele instanceof Circle) {//点到圆
        if(a == ele.cx && b == ele.cy) return [ele.cx + ele.r, ele.cy];
        else{
            let [cx, cy, r] = [ele.cx, ele.cy, ele.r];
            let d = Math.sqrt((a - cx) ** 2 + (b - cy) ** 2);
            return [cx + r * (a - cx) / d, cy + r * (b - cy) / d];
        }
    } else if(ele instanceof Arc) {//点到弧
        let resx, resy, cx, cy, att;
        cx = ele.centerPoint.x;
        cy = ele.centerPoint.y;
        r = distance(ele.centerPoint, ele.startPoint);
        if(a == ele.cx && b == ele.cy) [resx, resy] = [cx + r, cy];
        else{
            let d = Math.sqrt((a - cx) ** 2 + (b - cy) ** 2);
            [resx, resy] = [cx + r * (a - cx) / d, cy + r * (b - cy) / d];
        }
        att = ele.getArcAttributes();
        let [fromx, fromy, tox, toy] = [att[0], att[1], att[7], att[8]];
        let fromdeg = getLineAngle(cx, cy, fromx, fromy);
        let todeg =  getLineAngle(cx, cy, tox, toy);
        if(todeg > fromdeg) fromdeg += 360;//保证 fromdeg > todeg
        let resdeg = getLineAngle(cx, cy, resx, resy);
        if((resdeg >= todeg && resdeg <= fromdeg) || (resdeg + 360 >= todeg && resdeg + 360 <= fromdeg))
            return [resx, resy];
        else if(distance(fromx, fromy, a, b) < distance(tox, toy, a, b))
            return [fromx, fromy];
        else return [tox, toy];
    }
}
//for test
// paintArea.addEventListener("mousemove", (event) => {
//     let dis = 9999999;
//     let ans = [-1, -1];
//     //console.log("start");
//     for(let i of shapes){
//         let d = distance(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"), i);
//         //console.log(d);
//         if(d < dis){
//             dis = d;
//             ans = getTheNearest(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"), i);
//         }
//     }
//     document.getElementById("a point for test").setAttribute("cx", ans[0]);
//     document.getElementById("a point for test").setAttribute("cy", ans[1]);
// })
//for test
//计算两点间距离的函数
function distance(x1, y1, x2, y2) {
    if(! [x1, y1, x2, y2].includes(undefined))
        return Math.sqrt(Math.abs(x1 - x2) ** 2 + Math.abs(y1 - y2) ** 2);
    else if(typeof x1 == "number" && typeof y1 == "number") {//表明是计算一个坐标和另一个几何元素的距离
        return distance(x1, y1, ...getTheNearest(x1, y1, x2));
    } else if(x1 instanceof Point) {
        return distance(x1.x, x1.y, y1, y2);
    }
}
//计算一条射线的角度（角度制）（0 ~ 360°）
function getLineAngle(fromX, fromY, toX, toY) {
    let dis = distance(fromX, fromY, toX, toY);
    toX = fromX + (toX - fromX) / dis;
    toY = fromY + (toY - fromY) / dis;
    let ans = Math.asin(fromY - toY) * (180 / Math.PI);
    if(toX < fromX) ans = 180 - ans;//这两行的顺序千万不能调换！
    if(ans < 0) ans += 360;//这两行的顺序千万不能调换！
    return ans;
}
//计算从始边逆时针旋转到终边的角度（角度制）：
//  以 (cx, cy) -> (x1, y1) 的射线为始边，逆时针旋转到 (cx, cy) -> (x2, y2) 这条射线的角度
function getAngle(x1, y1, x2, y2, cx, cy) {
    let startAngle = getLineAngle(cx, cy, x1, y1);
    let endAngle = getLineAngle(cx, cy, x2, y2);
    let ans = endAngle - startAngle;
    if(ans < 0) ans += 360;
    return ans;
}
//实时改变 SVG 的 viewBox
function updSVGSize() {
    canvasinfo.width *= window.innerWidth / canvasinfo.befWidth;
    canvasinfo.height *= window.innerHeight / canvasinfo.befHeight;
    [canvasinfo.befWidth, canvasinfo.befHeight] = [window.innerWidth, window.innerHeight];
    paintArea.setAttribute("viewBox",
    `${canvasinfo.topLeftX} ${canvasinfo.topLeftY} ${canvasinfo.width} ${canvasinfo.height}`);
}
updSVGSize();
addEventListener("resize", updSVGSize);
//侧边栏收起/展开
function hideAside() {
    document.getElementById("create-mode").style.display = "none";
    document.getElementById("edit-mode").style.display = "none";
    document.getElementById("fixed-elements").style.display = "none";
    aside.style.width = 0;
    setTimeout(() => {
        document.getElementById("show-aside").style.display = "inline";
    }, 1500);
}
function showAside() {
    aside.style.width = "max(20vw, 8em)";
    document.getElementById("show-aside").style.display = "none";
    // setTimeout(() => aside.innerHTML = ASIDE_CONTENT, 1500);
    setTimeout(() => {
        if(operate == "edit") document.getElementById("edit-mode").style.display = "inline";
        else document.getElementById("create-mode").style.display = "inline";
        document.getElementById("fixed-elements").style.display = "inline";
    }, 1500);
}
//创建 SVG 元素的函数
function createSVG(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

//*********************************  所有图形的基类  *********************************
class Shape {
    static shapes = [];
    static _subClasses = [Point, Line, Circle, Arc];
    static wheel(scale) {
        for(let i of Shape._subClasses)
            i.wheel(scale);
    }
    static updateAll() {
        for(let i of Shape._subClasses)
            i.updateAll();
    }
    constructor(name, discription) {
        if(this.constructor !== Shape)//防止子类统计将自己加进去
            Shape._subClasses.add(this.constructor);
        this.id = Shape.shapes.length;
        this.name = name;//元素的名称，比如：点A、点C'、线段AB、圆O、弧AB
        this.discription = discription;//详细介绍（可以为空），比如：线段AB的中点、线段DE上的点、以O为中心的弧
        Shape.shapes.push(this);
    }
}
setInterval(Shape.updateAll, UPD_TIMEOUT);

//*********************************  点  *********************************
class Point extends Shape{
    static _r = 7;
    static _pointNameOffset = 10;
    static _pointNameFontSize = 15;
    static _points = [];
    static _pointNames = [];//目前所有点的名字
    static getNewPointName() {//为点获取一个不与其它点重复的名称（按照 A->B->C->...->Z->A'->B'->...->Z'->A''->... 的顺序从左往右搜索，寻找最近的未被占用的名称）
        for(let i=0; ; i++) {
            let res = String.fromCodePoint(i % 26 + "A".charCodeAt(0));
            for(let j=1; j <= i/26; j++) res += "'";
            let flag = true;//是否能够取这个名
            for(let name of Point._pointNames)
                if(name == res) {
                    flag = false;
                    break;
                }
            if(flag) return res;
        }
    }
    static updateAll() {
        for(let point of Point._points) point.update();
    }
    static wheel(scale) {
        Point._r *= scale;
        Point._pointNameOffset *= scale;
        Point._pointNameFontSize *= scale;
        Point.updateAll();
    }
    constructor(startX, startY, restrictions) {
        //startX, startY: 点的初始位置
        //restrictions: 点的限制，应为一个包含 restrictType 和 connectEle 属性的对象，
        //    其中 restrictType 代表限制类型，connectEle 代表关联的几何元素数组。
        //    restrictType 取值可以为
        //        - free 该点可以随意拖动，此时 connectEle 应为 []。
        //        - on 在某个几何元素（如线段，圆，弧）上，此时 connectEle 应为 [Shape]，包含一个几何元素，表示点在其上。
        //             可以对该点进行拖动，但是只能在那个几何元素上。
        //        - midpoint 某两个点的中点，此时 connectEle 应为 [Point, Point]。点不可拖动。
        let pointName = Point.getNewPointName();
        let connectEle = restrictions.connectEle;
        switch(restrictions.restrictType) {
            case "free":
                super(`点${pointName}`, `点`);
                break;
            case "on":
                super(`点${pointName}`, `${connectEle[0].name}上的点`);
                break;
            case "midpoint":
                super(`点${pointName}`, `${connectEle[0].name}和${connectEle[1]}的中点`);
                break;
        }
        Point._pointNames.push(pointName);

        this.x = startX;
        this.y = startY;
        this.SVGpoint = createSVG("circle");
        this.SVGpointName = createSVG("text");
        this.draginfo = {
            "dragStart": [NaN, NaN],
            "mousedown": false,//已经按下鼠标
            "dragMoved": false//按下鼠标并已经拖动超过阈值
        };
        this.restrictions = restrictions;
        this.SVGpoint.setAttribute("class", "point");
        this.SVGpointName.setAttribute("class", "pointNameTag");
        this.SVGpointName.innerHTML = this.name.substr(1);
        this.update("init");
        paintArea.appendChild(this.SVGpoint);
        paintArea.appendChild(this.SVGpointName);
        Point._points.push(this);

        this.SVGpoint.addEventListener("mousedown", (event) => {
            this.draginfo.mousedown = true;
            this.draginfo.dragStart = [event.offsetX, event.offsetY];
            event.stopPropagation();
        });
        paintArea.addEventListener("mousemove", (event) => {
            if(this.draginfo.mousedown) {
                this.moveTo(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"));
                if(distance(event.offsetX, event.offsetY, this.draginfo.dragStart[0], this.draginfo.dragStart[1]) >= draginfo.MOVE_THRESHOLD)
                    this.draginfo.dragMoved = true;
                event.stopPropagation();
            }
        });
        paintArea.addEventListener("mouseleave", (event) => {
            this.draginfo.dragMoved = this.draginfo.mousedown = false;
            this.draginfo.dragStart = [NaN, NaN];
        })
        paintArea.addEventListener("mouseup", (event) => {
            if(this.draginfo.mousedown && !this.draginfo.dragMoved &&
              POINT_CAN_CHOOSE.includes(operate)/*只有在一些特定模式下才能选中点*/)
                this.choose();
            if(this.draginfo.mousedown) justMovingPoints = true;
            this.draginfo.mousedown = this.draginfo.dragMoved = false;
            this.draginfo.dragStart = [NaN, NaN];
        });
    }
    choose() {
        let index = choosed.indexOf(this);
        if(index == -1) {
            this.SVGpoint.setAttribute("class", "active-point");
            choosed.push(this);
            raiseEvent();//判断是否需要进行操作并在需要时执行对应操作（比如连线）
        } else {
            this.cancelActive();
            choosed.splice(index, 1);
        }
    }
    update() {
        this.SVGpoint.setAttribute("cx", this.x);
        this.SVGpoint.setAttribute("cy", this.y);
        this.SVGpoint.setAttribute("r", Point._r);
        this.SVGpoint.setAttribute("stroke-width", Point._r / 2);
        this.moveTo(this.x, this.y);
        this.SVGpointName.setAttribute("x", this.x + Point._pointNameOffset);
        this.SVGpointName.setAttribute("y", this.y - Point._pointNameOffset);
        this.SVGpointName.setAttribute("font-size", Point._pointNameFontSize);
    }
    cancelActive() {
        this.SVGpoint.setAttribute("class", "point");
    };
    moveTo(toX, toY) {
        let connectEle = this.restrictions.connectEle;
        switch(this.restrictions.restrictType) {
            case "free":
                [this.x, this.y] = [toX, toY];
                break;
            case "on":
                [this.x, this.y] = getTheNearest(this.x, this.y, connectEle[0]);
                break;
            case "midpoint":
                [this.x, this.y] = [(connectEle[0].x + connectEle[1].x) / 2, (connectEle[0].y + connectEle[1].y) / 2];
                break;
        }
    }
}
//*********************************  线  *********************************
class Line extends Shape{
    static _strokeWidth = 2;
    static _lines = [];
    static updateAll() {
        for(let line of Line._lines)
            line.update();
    }
    constructor(x1, y1, x2, y2, name, discription) {
        super(name, discription);
        [this.x1, this.y1, this.x2, this.y2] = [x1, y1, x2, y2];
        this.SVGline = createSVG("line");
        this.update("init");
        this.SVGline.setAttribute("class", "line");
        paintArea.prepend(this.SVGline);//让点在最上层，用户体验更佳
        Line._lines.push(this);
    }
    update() {
        this.SVGline.setAttribute("x1", this.x1);
        this.SVGline.setAttribute("y1", this.y1);
        this.SVGline.setAttribute("x2", this.x2);
        this.SVGline.setAttribute("y2", this.y2);
        this.SVGline.setAttribute("stroke-width", Line._strokeWidth);
    }
    static wheel(scale) {
        Line._strokeWidth *= scale;
        Line.updateAll();
    }
}
//线段
class LineSeg extends Line {
    constructor(point1, point2) {//用两个点对象作参数
        super(point1.x, point1.y, point2.x, point2.y,
            `线段${point1.name.substr(1)}${point2.name.substr(1)}`, `连接${point1.name}、${point2.name}的线段`);
        this.point1 = point1;
        this.point2 = point2;
    }
    update(type) {
        if(type !== "init") {//如果是初始化时的调用，会传参 type="init"，以防止第一行必须用 super 而导致的子类私有属性未定义（在 this.getArcAttributes() 中有调用子类私有属性）
            [this.x1, this.y1] = [this.point1.x, this.point1.y];
            [this.x2, this.y2] = [this.point2.x, this.point2.y];
        }
        super.update();
    }
}
//射线
class Ray extends Line {
    constructor(fromPoint, toPoint) {
        super(0, 0, 0, 0,//反正最后会更新
            `射线${fromPoint.name.substr(1)}${toPoint.name.substr(1)}`, `从${fromPoint.name}到${toPoint.name}的射线`
        );
        this.fromPoint = fromPoint;
        this.toPoint = toPoint;
    }
    update(type) {
        if(type !== "init") {
            let [fromPoint, toPoint] = [this.fromPoint, this.toPoint];
            let INF = Math.max(canvasinfo.width, canvasinfo.height) * 5;
            [this.x1, this.y1] = [fromPoint.x, fromPoint.y];
            if(toPoint.x != fromPoint.x) {//防止除以零导致的奇怪的行为
                if(fromPoint.x < toPoint.x)
                    [this.x2, this.y2] = [fromPoint.x + INF, fromPoint.y + (toPoint.y - fromPoint.y) * INF / (toPoint.x - fromPoint.x)];
                else [this.x2, this.y2] = [fromPoint.x - INF, fromPoint.y - (toPoint.y - fromPoint.y) * INF / (toPoint.x - fromPoint.x)];
            } else if(toPoint.y >= fromPoint.y) [this.x2, this.y2] = [fromPoint.x, INF];
            else [this.x2, this.y2] = [fromPoint.x, -INF]
        }
        super.update();
    }
}
//直线
class StraightLine extends Line {
    constructor(point1, point2) {
        super(0, 0, 0, 0,//反正最后会更新
            `直线${point1.name.substr(1)}${point1.name.substr(1)}`, `${point1.name}和${point2.name}之间的直线`
        );
        [this.point1, this.point2] = [point1, point2];
    }
    update(type) {
        if(type !== "init") {
            let [pt1, pt2] = [this.point1, this.point2];
            let INF = Math.max(canvasinfo.width, canvasinfo.height) * 5;
            if(pt1.x != pt2.x) {
                if(pt1.x > pt2.x) {
                    let tmp = pt1;
                    pt1 = pt2;
                    pt2 = tmp;
                }
                [this.x1, this.y1] = [pt1.x - INF, pt1.y - (pt2.y - pt1.y) * INF / (pt2.x - pt1.x)];
                [this.x2, this.y2] = [pt1.x + INF, pt1.y + (pt2.y - pt1.y) * INF / (pt2.x - pt1.x)];
            } else [this.x1, this.y1, this.x2, this.y2] = [pt1.x, -INF, pt1.x, INF];
        }
        super.update();
    }
}
//*********************************  圆  *********************************
class Circle extends Shape{
    static _strokeWidth = 2;
    static _circles = [];
    static updateAll() {
        for(let circle of Circle._circles) circle.update();
    }
    static wheel(scale) {
        Circle._strokeWidth *= scale;
        Circle.updateAll(); 
    }
    constructor(cx, cy, r, name, discription) {
        super(name, discription);
        [this.cx, this.cy, this.r] = [cx, cy, r];
        this.svgCircle = createSVG("circle");
        this.svgCircle.setAttribute("class", "circle");
        this.update("init");
        paintArea.prepend(this.svgCircle);
        Circle._circles.push(this);
    }
    update() {
        this.svgCircle.setAttribute("stroke-width", Circle._strokeWidth);
        this.svgCircle.setAttribute("cx", this.cx);
        this.svgCircle.setAttribute("cy", this.cy);
        this.svgCircle.setAttribute("r", this.r);
    }
}
//圆心和圆上一点构造圆
class CenterAndPointCircle extends Circle {
    constructor(centerPoint, otherPoint) {
        super(centerPoint.x, centerPoint.y, distance(centerPoint.x, centerPoint.y, otherPoint.x, otherPoint.y),
            `圆${centerPoint.name.substr(1)}`,
            `以${centerPoint.name}为圆心，${otherPoint.name}为圆上一点构造的圆`
        );
        this.centerPoint = centerPoint;
        this.otherPoint = otherPoint;
    }
    update(type) {
        if(type !== "init") {
            this.cx = this.centerPoint.x;
            this.cy = this.centerPoint.y;
            this.r = distance(this.centerPoint.x, this.centerPoint.y, this.otherPoint.x, this.otherPoint.y);
        }
        super.update();
    }
}

//*********************************  弧  *********************************
class Arc extends Shape{//始终从起点到终点顺时针画弧，并以起始点确定半径
    static _arcs = [];
    static _strokeWidth = 2;
    static getArcAttributes(centerPoint, startPoint, endPoint) {
        let ans = [];
        ans.push(startPoint.x);//起点
        ans.push(startPoint.y);
        ans.push(distance(startPoint.x, startPoint.y, centerPoint.x, centerPoint.y));//半径
        ans.push(ans[2]);
        ans.push(0);//旋转角度
        ans.push(360 - getAngle(startPoint.x, startPoint.y, endPoint.x,
            endPoint.y, centerPoint.x, centerPoint.y) > 180 ? 1 : 0);//大弧标志
        ans.push(1);//扫掠标志（是否为顺时针）
        let endAngleRad = getLineAngle(centerPoint.x, centerPoint.y, endPoint.x, endPoint.y) * (Math.PI / 180);
        ans.push(centerPoint.x + ans[2] * Math.cos(endAngleRad));//注意：弧的终点由半径、圆心和角度决定，并不是 endPoint 的坐标
        ans.push(centerPoint.y - ans[2] * Math.sin(endAngleRad));//计算结束点
        return ans;
    }
    static updateAll() {
        for(let arc of Arc._arcs) arc.update();
    }
    static wheel(scale) {
        Arc._strokeWidth *= scale;
        Arc.updateAll();
    }
    constructor(centerPoint, startPoint, endPoint, name, discription) {
        //attArray = Arc.getArcAttributes(centerPoint, startPoint, endPoint);
        super(name, discription);
        this.centerPoint = centerPoint;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.svgArc = createSVG("path");
        paintArea.prepend(this.svgArc);
        this.svgArc.setAttribute("class", "arc");
        this.update("init");
        Arc._arcs.push(this);
    }
    getArcAttributes() {
        return Arc.getArcAttributes(this.centerPoint, this.startPoint, this.endPoint);
    }
    update() {
        let att = this.getArcAttributes();
        this.svgArc.setAttribute("d", 
            `M ${att[0]} ${att[1]} A ${att.slice(2).join(" ")}`
        );
        this.svgArc.setAttribute("stroke-width", Arc._strokeWidth);
    }
}

paintArea.addEventListener("click", //创建点的程序
(event) => {
    if(!draginfo.moved && !justMovingPoints) {
        switch(operate) {
            case "create-points":
                let clickPos = [pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y")];
                let adsorbEle = [];
                for(let ele of Shape.shapes){
                    if(!(ele instanceof Point) && distance(...clickPos, ele) < nearThreshold)
                        adsorbEle.push(ele);
                }
                if(adsorbEle.length >= 1){
                    new Point(...clickPos,
                    {
                        restrictType: "on",
                        connectEle: [adsorbEle[0]]
                    });
                }else new Point(...clickPos,
                    {
                        restrictType: "free",
                        connectEle: []
                    });
                break;
        }
    }
    justMovingPoints = false;
})
paintArea.addEventListener("mousedown", (event) => {
    draginfo.dragging = true; draginfo.moved = false;
    draginfo.mouseStart = draginfo.lastPos = [event.offsetX, event.offsetY];
});
paintArea.addEventListener("mouseup", () => {draginfo.dragging = false; paintArea.style.cursor = "default";});
paintArea.addEventListener("mouseleave", () => {draginfo.dragging = false; paintArea.style.cursor = "default"});
paintArea.addEventListener("mousemove", (event) => {
    if(draginfo.dragging) {
        paintArea.style.cursor = "grab";
        canvasinfo.topLeftX -= (event.offsetX - draginfo.lastPos[0]) / window.innerWidth * canvasinfo.width;
        canvasinfo.topLeftY -= (event.offsetY - draginfo.lastPos[1]) / window.innerHeight * canvasinfo.height;
        draginfo.lastPos = [event.offsetX, event.offsetY];
        if(distance(...draginfo.lastPos, ...draginfo.mouseStart) > draginfo.MOVE_THRESHOLD) draginfo.moved = true;
        updSVGSize();
    }
});
paintArea.addEventListener("wheel", (event) => {
    let bigger = event.deltaY < 0;
    let scale = bigger ? 1 / SCALE : SCALE;
    let x = pxToSVG(event.offsetX, "x");
    let y = pxToSVG(event.offsetY, "y");
    canvasinfo.topLeftX = x - (x - canvasinfo.topLeftX) * scale;
    canvasinfo.topLeftY = y - (y - canvasinfo.topLeftY) * scale;
    canvasinfo.width *= scale; canvasinfo.height *= scale;
    nearThreshold *= scale;
    updSVGSize();
    Shape.wheel(scale);
    event.preventDefault();
});