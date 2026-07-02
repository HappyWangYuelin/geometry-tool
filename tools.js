//_________________________________________________________________________________________________________
//=================================================  工具函数  =============================================
//_________________________________________________________________________________________________________

import * as cnf from './config.js'
import * as sh from './geometry_shapes.js'

//转换屏幕坐标系到 SVG 坐标系的函数
export function pxToSVG(px, what) {
    if(what == "x") return cnf.canvasinfo.topLeftX + px / window.innerWidth * cnf.canvasinfo.width;
    else if(what == "y") return cnf.canvasinfo.topLeftY + px / window.innerHeight * cnf.canvasinfo.height;
}
// 通过路径来修改对象值的方法，比如：modifyByPath(obj, "a.b.c.d", 1) 等同于 obj.a.b.c.d = 1。而 obj["a.b.c.d"] = 1，无法调用多层，只代表单层属性
export function modifyByPath(obj, path, changeTo) {
    let pathArr = path.split(".");
    for(let i=0; i<pathArr.length; i++) {
        if(i == pathArr.length - 1)
            obj[pathArr[i]] = changeTo;// 不能在最后将循环 pathArr.length 次之后的 obj 进行赋值，因为这样就覆盖了原地址，外部不会起到修改效果
        else obj = obj[pathArr[i]];
    }
}
export function getTheNearest(a, b, ele) {//获取几何元素 ele 距离 (a, b) 最近的点
    if(ele instanceof sh.Point) return [ele.x, ele.y];//点到点
    else if(ele instanceof sh.Line) {//点到线
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
    } else if(ele instanceof sh.Circle) {//点到圆
        if(a == ele.cx && b == ele.cy) return [ele.cx + ele.r, ele.cy];
        else{
            let [cx, cy, r] = [ele.cx, ele.cy, ele.r];
            let d = Math.sqrt((a - cx) ** 2 + (b - cy) ** 2);
            return [cx + r * (a - cx) / d, cy + r * (b - cy) / d];
        }
    } else if(ele instanceof sh.Arc) {//点到弧
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
//计算两点间距离的函数
export function distance(x1, y1, x2, y2) {
    if(! [x1, y1, x2, y2].includes(undefined))
        return Math.sqrt(Math.abs(x1 - x2) ** 2 + Math.abs(y1 - y2) ** 2);
    else if(typeof x1 == "number" && typeof y1 == "number") {//表明是计算一个坐标和另一个几何元素的距离
        return distance(x1, y1, ...getTheNearest(x1, y1, x2));
    } else if(x1 instanceof sh.Point) {
        return distance(x1.x, x1.y, y1, y2);
    }
}
//计算一条射线的角度（角度制）（0 ~ 360°）
export function getLineAngle(fromX, fromY, toX, toY) {
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
export function getAngle(x1, y1, x2, y2, cx, cy) {
    let startAngle = getLineAngle(cx, cy, x1, y1);
    let endAngle = getLineAngle(cx, cy, x2, y2);
    let ans = endAngle - startAngle;
    if(ans < 0) ans += 360;
    return ans;
}
