//*********************************  一些全局常量和变量  *********************************
//用于缩放
const SCALE = 1.2;
//程序常用 DOM 对象
var paintArea = document.getElementById("paint-area");
var aside = document.getElementsByTagName("aside")[0];
//用于记录所有创建的形状
var shapes = [];
//用于显示和隐藏侧边栏
const ASIDE_CONTENT = aside.innerHTML;
//用于拖动画布
var dragging = false;
var mouseStart = [0,0];
var moved = false;//判断到底是拖动还是点击
const MOVE_THRESHOLD = 5;//移动超过几像素算作移动而不算作点击
var lastX = 0;
var lastY = 0;
//用于调整画布尺寸
var topLeftX = - window.innerWidth / 2;
var topLeftY = - window.innerHeight / 2;
var width = window.innerWidth, befWidth = width;
var height = window.innerHeight, befHeight = height;
//每个多少秒将所有的元素位置重新根据各个自由拖动点的位置更新
const UPD_TIMEOUT = 10;
//用于对选择过的几何元素进行存储
var choosed = [];
//可以对各种几何图形进行选中的操作模式数组
const POINT_CAN_CHOOSE = ["create-line-seg", "create-clockwise-arc", "create-circle"];//可以对点进行选中的操作模式
const OPERATE_FUNCTIONS = {//对于每个需要选中元素的操作，定义选中的数量和对应的处理函数
    "create-line-seg": [2, () => new LineSeg(...choosed)],//对 create-lines 操作，在选中超过两个点时，创建一条新线段
    "create-clockwise-arc": [3, () => new Arc(...choosed)],
    "create-circle" :[2, () => new CenterAndPointCircle(...choosed)]
}
//全局操作类型
var operate = "create-points";
/*操作的值包括：
create-circle 圆（圆心+圆上一点）
create-points 描点
create-line-seg 连线（线段）
create-clockwise-arc 绘制顺时针圆弧
*/
//切换操作类型的函数
function setOperate(newOp) {
    operate = newOp;
    choosed.forEach((value, index, array) => value.cancelActive());
    choosed = [];
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
    if(what == "x") return topLeftX + px / window.innerWidth * width;
    else if(what == "y") return topLeftY + px / window.innerHeight * height;
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
paintArea.addEventListener("mousemove", (event) => {
    let dis = 9999999;
    let ans = [-1, -1];
    //console.log("start");
    for(let i of shapes){
        let d = distance(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"), i);
        //console.log(d);
        if(d < dis){
            dis = d;
            ans = getTheNearest(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"), i);
        }
    }
    document.getElementById("a point for test").setAttribute("cx", ans[0]);
    document.getElementById("a point for test").setAttribute("cy", ans[1]);
})
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
    width *= window.innerWidth / befWidth;
    height *= window.innerHeight / befHeight;
    [befWidth, befHeight] = [window.innerWidth, window.innerHeight];
    paintArea.setAttribute("viewBox",
    `${topLeftX} ${topLeftY} ${width} ${height}`);
}
updSVGSize();
window.addEventListener("resize", updSVGSize);
//侧边栏收起/展开
function hideAside() {
    document.getElementsByTagName("aside")[0].style.width = 0;
    aside.innerHTML = "";
    setTimeout(() => document.getElementById("show-aside").style.display = "inline", 1500);
}
function showAside() {
    document.getElementsByTagName("aside")[0].style.width = "max(20vw, 8em)";
    document.getElementById("show-aside").style.display = "none";
    setTimeout(() => aside.innerHTML = ASIDE_CONTENT, 1500);
}
//创建 SVG 元素的函数
function createSVG(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

//*********************************  点  *********************************
class Point {
    static _r = 7;
    static _points = [];
    static updateAll() {
        for(let point of Point._points) point.update();
    }
    constructor(startX, startY, draggable, dragThreshold, normalClass) {
        this.x = startX;
        this.y = startY;
        this.SVGpoint = createSVG("circle");
        this.normalClass = normalClass;
        this.draginfo = {
            "draggable": draggable,//是否可拖动
            "dragStart": [NaN, NaN],
            "dragThreshold": dragThreshold,//拖动阈值
            "mousedown": false,//已经按下鼠标
            "dragMoved": false//按下鼠标并已经拖动超过阈值
        };
        this.SVGpoint.setAttribute("class", normalClass);
        this.update();
        paintArea.appendChild(this.SVGpoint);
        Point._points.push(this);
        shapes.push(this);

        this.SVGpoint.addEventListener("mousedown", (event) => {
            this.draginfo.mousedown = true;
            this.draginfo.dragStart = [event.offsetX, event.offsetY];
            event.stopPropagation();
        });
        paintArea.addEventListener("mousemove", (event) => {
            if(this.draginfo.mousedown) {
                this.moveTo(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"));
                if(distance(event.offsetX, event.offsetY, this.draginfo.dragStart[0], this.draginfo.dragStart[1]) >= this.draginfo.dragThreshold)
                    this.draginfo.dragMoved = true;
                event.stopPropagation();
            }
        });
        paintArea.addEventListener("mouseup", (event) => {
            if(this.draginfo.mousedown && !this.draginfo.dragMoved &&
              POINT_CAN_CHOOSE.includes(operate)/*只有在一些特定模式下才能选中点*/)
                this.choose();
            this.draginfo.mousedown = this.draginfo.dragMoved = false;
            this.draginfo.dragStart = [NaN, NaN];
            event.stopPropagation();
        });
        this.SVGpoint.addEventListener("click", (event) => {event.stopPropagation()})
    }
    static wheel(scale) {
        Point._r *= scale;
        Point.updateAll();
    }
    choose () {
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
    }
    cancelActive() {
        this.SVGpoint.setAttribute("class", this.normalClass);
    };
    moveTo(toX, toY) {
        [this.x, this.y] = [toX, toY];
        this.update();
    }
}
//可自由拖动的点
class FreePoint extends Point{
    constructor(startX, startY) {
        super(startX, startY, true, MOVE_THRESHOLD, "free-point");
    }
}

//*********************************  线  *********************************
class Line {
    static _strokeWidth = 2;
    static _lines = [];
    static updateAll() {
        for(let line of Line._lines)
            line.update();
    }
    constructor(x1, y1, x2, y2) {
        [this.x1, this.y1, this.x2, this.y2] = [x1, y1, x2, y2];
        this.SVGline = createSVG("line");
        this.update("init");
        this.SVGline.setAttribute("class", "line");
        paintArea.appendChild(this.SVGline);
        Line._lines.push(this);
        shapes.push(this);
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
setInterval(Line.updateAll, UPD_TIMEOUT);
//线段
class LineSeg extends Line {
    constructor(point1, point2) {//用两个点对象作参数
        super(point1.x, point1.y, point2.x, point2.y);
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
//*********************************  圆  *********************************
class Circle {
    static _strokeWidth = 2;
    static _circles = [];
    static updateAll() {
        for(let circle of Circle._circles) circle.update();
    }
    static wheel(scale) {
        Circle._strokeWidth *= scale;
        Circle.updateAll(); 
    }
    constructor(cx, cy, r) {
        [this.cx, this.cy, this.r] = [cx, cy, r];
        this.svgCircle = createSVG("circle");
        this.svgCircle.setAttribute("class", "circle");
        this.update("init");
        paintArea.appendChild(this.svgCircle);
        Circle._circles.push(this);
        shapes.push(this);
    }
    update() {
        this.svgCircle.setAttribute("stroke-width", Circle._strokeWidth);
        this.svgCircle.setAttribute("cx", this.cx);
        this.svgCircle.setAttribute("cy", this.cy);
        this.svgCircle.setAttribute("r", this.r);
    }
}
setInterval(Circle.updateAll, UPD_TIMEOUT);
//圆心和圆上一点构造圆
class CenterAndPointCircle extends Circle {
    constructor(centerPoint, otherPoint) {
        super(centerPoint.x, centerPoint.y, distance(centerPoint.x, centerPoint.y, otherPoint.x, otherPoint.y));
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
class Arc {//始终从起点到终点顺时针画弧，并以起始点确定半径
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
    constructor(centerPoint, startPoint, endPoint) {
        //attArray = Arc.getArcAttributes(centerPoint, startPoint, endPoint);
        this.centerPoint = centerPoint;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.svgArc = createSVG("path");
        paintArea.appendChild(this.svgArc);
        this.svgArc.setAttribute("class", "arc");
        this.update("init");
        Arc._arcs.push(this);
        shapes.push(this);
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
setInterval(Arc.updateAll, UPD_TIMEOUT);

paintArea.addEventListener("click", 
(event) => {
    if(!moved) {
        switch(operate) {
            case "create-points": 
                new FreePoint(pxToSVG(event.offsetX, "x"), pxToSVG(event.offsetY, "y"));
                break;
        }
    }
})
paintArea.addEventListener("mousedown", (event) => {
    dragging = true; moved = false;
    mouseStart = [lastX, lastY] = [event.offsetX, event.offsetY];
});
paintArea.addEventListener("mouseup", () => {dragging = false; paintArea.style.cursor = "default";});
paintArea.addEventListener("mouseleave", () => {dragging = false; paintArea.style.cursor = "default"});
paintArea.addEventListener("mousemove", (event) => {
    if(dragging) {
        paintArea.style.cursor = "grab";
        topLeftX -= (event.offsetX - lastX) / window.innerWidth * width;
        topLeftY -= (event.offsetY - lastY) / window.innerHeight * height;
        lastX = event.offsetX; lastY = event.offsetY;
        if(distance(lastX, lastY, ...mouseStart) > MOVE_THRESHOLD) moved = true;
        updSVGSize();
    }
});
paintArea.addEventListener("wheel", (event) => {
    let bigger = event.deltaY < 0;
    let scale = bigger ? 1 / SCALE : SCALE;
    let x = pxToSVG(event.offsetX, "x");
    let y = pxToSVG(event.offsetY, "y");
    topLeftX = x - (x - topLeftX) * scale;
    topLeftY = y - (y - topLeftY) * scale;
    width *= scale; height *= scale;
    updSVGSize();
    Point.wheel(scale);
    Line.wheel(scale);
    Circle.wheel(scale);
    Arc.wheel(scale);
    event.preventDefault();
});