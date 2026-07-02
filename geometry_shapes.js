//_________________________________________________________________________________________________________
//=================================================各种图形类===============================================
//_________________________________________________________________________________________________________


//行内注释 “!==dd” 表示代码逻辑待定

/*开发备忘：
1、采用以 Shape 为基类，来继承出其它图形类的方式来设计，其中基类已经实现了 wheel 和 updateAll 方法，
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
        super([几何元素名称(name)], [元素信息(discription)], [类名(shapeType)]);
        [一些基本的参数设置]
        this.shapeType = [类名];
        this.[用来存对应的 SVG 对象的属性] = createSVG([SVG 标签名]);
        [类名].[存实例用的数组名].push(this);
        this.update("init");

        cnf.paintArea.prepend(this.[用来存对应的 SVG 对象的属性]);
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


import * as cnf from './config.js'
import * as tls from './tools.js'
import * as itr from './interaction.js'
import * as sts from './style_setting.js'

//用来创建 SVG 图形的函数
function createSVG(tagName) {
    return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}

//*********************************  所有图形的基类  *********************************
export class Shape {
    static shapes = [];
    static _subClasses = new Set();
    static wheel(scale) {
        for(let i of Shape._subClasses)
            i.wheel(scale);
    }
    static updateAll() {
        for(let i of Shape._subClasses)
            i.updateAll();
    }
    constructor(name, discription, shapeType) {
        Shape._subClasses.add(shapeType);
        this.shapeType = shapeType;
        this.id = Shape.shapes.length;
        this.name = name;//元素的名称，比如：点A、点C'、线段AB、圆O、弧AB
        this.discription = discription;//详细介绍（可以为空），比如：线段AB的中点、线段DE上的点、以O为中心的弧
        this.styles = {};// 样式配置的对象（不能轻易改名！./style_setting.js 有依赖）
        Shape.shapes.push(this);
    }
    getDefaultStyles() {
        let shapename = cnf.SHAPENAME[this.shapeType.name];
        let dft_style = sts.DEFAULT_CSS_STYLES[shapename];
        if(shapename === "点")
            this.styles = {
                normalPoint: new sts.StyleConfig(this.SVGpoint, dft_style.normalPoint, true),
                activePoint: new sts.StyleConfig(this.SVGpoint, dft_style.activePoint, false),
                pointName: new sts.StyleConfig(this.SVGpointName, dft_style.pointName, true)
            };
        else if(shapename === "线图形")
            this.styles = {
                normalShape: new sts.StyleConfig(this.SVGShape, dft_style.normalShape, true)
            };
        else console.log("ERROR!!!!!!!!! " + shapename);
        sts.addStyleSettingFor(this);
    }
}

//*********************************  点  *********************************
export class Point extends Shape{
    static _r = 7;
    static _pointNameOffset = 10;
    static _pointNameFontSize = 20;
    static _points = [];
    static _pointNames = new Set();//目前所有点的名字
    static snapThreshold = 5;
    static getNewPointName() {//为点获取一个不与其它点重复的名称（按照 A->B->C->...->Z->A'->B'->...->Z'->A''->... 的顺序从左往右搜索，寻找最近的未被占用的名称）
        for(let i=0; ; i++) {
            let res = String.fromCodePoint(i % 26 + "A".charCodeAt(0));
            for(let j=1; j <= i/26; j++) res += "'";
            if(!Point._pointNames.has(res)){//!==dd
                Point._pointNames.add(res);
                return res;
            }
        }
    }
    static updateAll() {
        for(let point of Point._points) point.update();
    }
    static wheel(scale) {
        Point._r *= scale;
        Point._pointNameOffset *= scale;
        Point._pointNameFontSize *= scale;
        Point.snapThreshold *= scale;
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
                super(`点${pointName}`, `点`, Point);
                break;
            case "on":
                super(`点${pointName}`, `${connectEle[0].name}上的点`, Point);
                break;
            case "midpoint":
                super(`点${pointName}`, `${connectEle[0].name}和${connectEle[1]}的中点`, Point);
                break;
        }

        this.x = startX;
        this.y = startY;
        this.SVGpoint = createSVG("circle");
        this.SVGpointName = createSVG("text");
        this.draginfo = {
            "dragStart": [NaN, NaN],
            "mousedown": false,//是否已经按下鼠标
            "dragMoved": false//是否按下鼠标并已经拖动超过阈值
        };
        this.restrictions = restrictions;

        this.getDefaultStyles();

        //this.SVGpoint.setAttribute("class", "point");
        //this.SVGpointName.setAttribute("class", "pointNameTag");

        this.SVGpointName.innerHTML = pointName;
        this.update("init");
        cnf.paintArea.appendChild(this.SVGpoint);
        cnf.paintArea.appendChild(this.SVGpointName);
        Point._points.push(this);

        this.SVGpoint.addEventListener("mousedown", this.mousedown.bind(this));
        this.SVGpointName.addEventListener("mousedown", this.mousedown.bind(this));
        cnf.paintArea.addEventListener("mousemove", this.mousemove.bind(this));
        cnf.paintArea.addEventListener("mouseup", this.mouseup.bind(this));
    }
    mousedown(event) {
        this.draginfo.mousedown = true;
        this.draginfo.dragStart = [event.offsetX, event.offsetY];
        event.stopPropagation();
    }
    mousemove(event) {
        if(this.draginfo.mousedown) {
            this.moveTo(tls.pxToSVG(event.offsetX, "x"), tls.pxToSVG(event.offsetY, "y"));
            if(tls.distance(event.offsetX, event.offsetY, this.draginfo.dragStart[0], this.draginfo.dragStart[1]) >= cnf.draginfo.MOVE_THRESHOLD)
                this.draginfo.dragMoved = true;
            event.stopPropagation();
        }
    }
    mouseup(event) {
        if(this.draginfo.mousedown && !this.draginfo.dragMoved &&
           cnf.POINT_CAN_CHOOSE.includes(cnf.operate)/*只有在一些特定模式下才能选中点*/)
            this.choose();
        if(this.draginfo.mousedown) event.stopPropagation();
        this.draginfo.mousedown = this.draginfo.dragMoved = false;
        this.draginfo.dragStart = [NaN, NaN];
    }
    choose() {
        let index = cnf.choosed.indexOf(this);
        this.styles.activePoint.configOrDelete();
        this.styles.normalPoint.configOrDelete();
        if(index == -1) {
            // this.SVGpoint.setAttribute("class", "active-point");
            cnf.choosed.push(this);
            itr.raiseEvent();//判断是否需要进行操作并在需要时执行对应操作（比如连线）
        } else {
            cnf.choosed.splice(index, 1);
        }
    }
    cancelActive() {
        this.styles.activePoint.configOrDelete();
        this.styles.normalPoint.configOrDelete();
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
    moveTo(toX, toY) {
        let connectEle = this.restrictions.connectEle;
        switch(this.restrictions.restrictType) {
            case "free":
                [this.x, this.y] = [toX, toY];
                break;
            case "on":
                [this.x, this.y] = tls.getTheNearest(toX, toY, connectEle[0]);
                break;
            case "midpoint":
                [this.x, this.y] = [(connectEle[0].x + connectEle[1].x) / 2, (connectEle[0].y + connectEle[1].y) / 2];
                break;
        }
    }
}
//*********************************  线  *********************************
export class Line extends Shape{
    static _strokeWidth = 2;
    static _lines = [];
    static updateAll() {
        for(let line of Line._lines)
            line.update();
    }
    constructor(x1, y1, x2, y2, name, discription) {
        super(name, discription, Line);
        [this.x1, this.y1, this.x2, this.y2] = [x1, y1, x2, y2];
        this.SVGShape = createSVG("line");
        this.update("init");
        // this.SVGShape.setAttribute("class", "line");

        this.getDefaultStyles();

        cnf.paintArea.prepend(this.SVGShape);//让点在最上层，用户体验更佳
        Line._lines.push(this);
    }
    update() {
        this.SVGShape.setAttribute("x1", this.x1);
        this.SVGShape.setAttribute("y1", this.y1);
        this.SVGShape.setAttribute("x2", this.x2);
        this.SVGShape.setAttribute("y2", this.y2);
        this.SVGShape.setAttribute("stroke-width", Line._strokeWidth);
    }
    static wheel(scale) {
        Line._strokeWidth *= scale;
        Line.updateAll();
    }
}
//线段
export class LineSeg extends Line {
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
export class Ray extends Line {
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
            let INF = Math.max(cnf.canvasinfo.width, cnf.canvasinfo.height) * 5;
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
export class StraightLine extends Line {
    constructor(point1, point2) {
        super(0, 0, 0, 0,//反正最后会更新
            `直线${point1.name.substr(1)}${point2.name.substr(1)}`, `${point1.name}和${point2.name}之间的直线`
        );
        [this.point1, this.point2] = [point1, point2];
    }
    update(type) {
        if(type !== "init") {
            let [pt1, pt2] = [this.point1, this.point2];
            let INF = Math.max(cnf.canvasinfo.width, cnf.canvasinfo.height) * 5;
            if(pt1.x != pt2.x) {
                if(pt1.x > pt2.x) {
                    let tmp = pt1; pt1 = pt2; pt2 = tmp;
                }
                [this.x1, this.y1] = [pt1.x - INF, pt1.y - (pt2.y - pt1.y) * INF / (pt2.x - pt1.x)];
                [this.x2, this.y2] = [pt1.x + INF, pt1.y + (pt2.y - pt1.y) * INF / (pt2.x - pt1.x)];
            } else [this.x1, this.y1, this.x2, this.y2] = [pt1.x, -INF, pt1.x, INF];
        }
        super.update();
    }
}
//*********************************  圆  *********************************
export class Circle extends Shape{
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
        super(name, discription, Circle);
        [this.cx, this.cy, this.r] = [cx, cy, r];
        this.SVGShape = createSVG("circle");
        // this.SVGShape.setAttribute("class", "circle");
        this.update("init");

        this.getDefaultStyles();

        cnf.paintArea.prepend(this.SVGShape);
        Circle._circles.push(this);

        this.SVGShape.addEventListener("click", () => console.log("clicking a circle!"));
    }
    update() {
        this.SVGShape.setAttribute("stroke-width", Circle._strokeWidth);
        this.SVGShape.setAttribute("cx", this.cx);
        this.SVGShape.setAttribute("cy", this.cy);
        this.SVGShape.setAttribute("r", this.r);
    }
}
//圆心和圆上一点构造圆
export class CenterAndPointCircle extends Circle {
    constructor(centerPoint, otherPoint) {
        super(centerPoint.x, centerPoint.y, tls.distance(centerPoint.x, centerPoint.y, otherPoint.x, otherPoint.y),
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
            this.r = tls.distance(this.centerPoint.x, this.centerPoint.y, this.otherPoint.x, this.otherPoint.y);
        }
        super.update();
    }
}

//*********************************  弧  *********************************
export class Arc extends Shape{//始终从起点到终点顺时针画弧，并以起始点确定半径
    static _arcs = [];
    static _strokeWidth = 2;
    static getArcAttributes(centerPoint, startPoint, endPoint) {
        let ans = [];
        ans.push(startPoint.x);//起点
        ans.push(startPoint.y);
        ans.push(tls.distance(startPoint.x, startPoint.y, centerPoint.x, centerPoint.y));//半径
        ans.push(ans[2]);
        ans.push(0);//旋转角度
        ans.push(360 - tls.getAngle(startPoint.x, startPoint.y, endPoint.x,
            endPoint.y, centerPoint.x, centerPoint.y) > 180 ? 1 : 0);//大弧标志
        ans.push(1);//扫掠标志（是否为顺时针）
        let endAngleRad = tls.getLineAngle(centerPoint.x, centerPoint.y, endPoint.x, endPoint.y) * (Math.PI / 180);
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
        super(name, discription, Arc);
        this.centerPoint = centerPoint;
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.SVGShape = createSVG("path");
        cnf.paintArea.prepend(this.SVGShape);
        // this.SVGShape.setAttribute("class", "arc");

        this.getDefaultStyles();

        this.update("init");
        Arc._arcs.push(this);
    }
    getArcAttributes() {
        return Arc.getArcAttributes(this.centerPoint, this.startPoint, this.endPoint);
    }
    update() {
        let att = this.getArcAttributes();
        this.SVGShape.setAttribute("d", 
            `M ${att[0]} ${att[1]} A ${att.slice(2).join(" ")}`
        );
        this.SVGShape.setAttribute("stroke-width", Arc._strokeWidth);
    }
}