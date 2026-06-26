//_________________________________________________________________________________________________________
//====================================== HTML 交互函数和事件绑定=============================================
//_________________________________________________________________________________________________________

import * as sh from './geometry_shapes.js'
import * as cnf from './config.js'
import * as mth from './geometry_math.js'

//当选择几何元素时，对已选择的数量进行判断，从而进行诸如连线等的处理
export function raiseEvent() {//对此时的 choosed 数组进行处理，根据是否选了足够的元素来判断执行对应的操作
    if(cnf.choosed.length >= cnf.OPERATE_FUNCTIONS[cnf.operate][0]) {
       cnf.OPERATE_FUNCTIONS[cnf.operate][1]();
       cnf.choosed.forEach((value, index, array) => value.cancelActive());
       cnf.choosed.splice(0);
    }
}
//实时改变 SVG 的 viewBox
function updSVGSize() {
    cnf.canvasinfo.width *= window.innerWidth / cnf.canvasinfo.befWidth;
    cnf.canvasinfo.height *= window.innerHeight / cnf.canvasinfo.befHeight;
    [cnf.canvasinfo.befWidth, cnf.canvasinfo.befHeight] = [window.innerWidth, window.innerHeight];
    cnf.paintArea.setAttribute("viewBox",
    `${cnf.canvasinfo.topLeftX} ${cnf.canvasinfo.topLeftY} ${cnf.canvasinfo.width} ${cnf.canvasinfo.height}`);
}
//侧边栏收起/展开
function hideAside() {
    cnf.asideContent.style.display = "none";
    cnf.aside.style.width = 0;
    setTimeout(() => {
        document.getElementById("show-aside").style.display = "inline";
    }, 1500);
}
function showAside() {
    cnf.aside.style.width = "max(20vw, 8em)";
    document.getElementById("show-aside").style.display = "none";
    // setTimeout(() => aside.innerHTML = ASIDE_CONTENT, 1500);
    setTimeout(() => {
        cnf.asideContent.style.display = "block";
    }, 1500);
}
setInterval(sh.Shape.updateAll, cnf.UPD_TIMEOUT);
updSVGSize();
addEventListener("resize", updSVGSize);
cnf.aside.addEventListener("click", (ev) => {
    let tgt = ev.target.closest('[data-op]');
    if(tgt){
        cnf.setOperate(tgt.getAttribute("data-op"));
    }
});
document.getElementById("show-aside").addEventListener("click", showAside);
document.getElementById("hide-aside").addEventListener("click", hideAside);
cnf.board.addEventListener("mouseup", //创建点的程序
(event) => {
    if(!cnf.draginfo.moved) {
        switch(cnf.operate) {
            case "create-points":
                let clickPos = [mth.pxToSVG(event.offsetX, "x"), mth.pxToSVG(event.offsetY, "y")];
                let snapEle = [];
                for(let ele of sh.Shape.shapes){
                    if(!(ele instanceof sh.Point) && mth.distance(...clickPos, ele) < sh.Point.snapThreshold)
                        snapEle.push(ele);
                }
                if(snapEle.length >= 1){
                    new sh.Point(...clickPos,
                    {
                        restrictType: "on",
                        connectEle: [snapEle[0]]
                    });
                }else new sh.Point(...clickPos,
                    {
                        restrictType: "free",
                        connectEle: []
                    });
                break;
        }
    }
})
cnf.board.addEventListener("mousedown", (event) => {
    cnf.draginfo.dragging = true; cnf.draginfo.moved = false;
    cnf.draginfo.mouseStart = cnf.draginfo.lastPos = [event.offsetX, event.offsetY];
});
cnf.board.addEventListener("mouseup", () => {cnf.draginfo.dragging = false; cnf.paintArea.style.cursor = "default";});
cnf.board.addEventListener("mouseleave", () => {cnf.draginfo.dragging = false; cnf.paintArea.style.cursor = "default";});
cnf.board.addEventListener("mousemove", (event) => {
    if(cnf.draginfo.dragging) {
        cnf.paintArea.style.cursor = "grab";
        cnf.canvasinfo.topLeftX -= (event.offsetX - cnf.draginfo.lastPos[0]) / window.innerWidth * cnf.canvasinfo.width;
        cnf.canvasinfo.topLeftY -= (event.offsetY - cnf.draginfo.lastPos[1]) / window.innerHeight * cnf.canvasinfo.height;
        cnf.draginfo.lastPos = [event.offsetX, event.offsetY];
        if(mth.distance(...cnf.draginfo.lastPos, ...cnf.draginfo.mouseStart) > cnf.draginfo.MOVE_THRESHOLD) cnf.draginfo.moved = true;
        updSVGSize();
    }
});
cnf.board.addEventListener("wheel", (event) => {
    let bigger = event.deltaY < 0;
    let scale = bigger ? 1 / cnf.SCALE : cnf.SCALE;
    let x = mth.pxToSVG(event.offsetX, "x");
    let y = mth.pxToSVG(event.offsetY, "y");
    cnf.canvasinfo.topLeftX = x - (x - cnf.canvasinfo.topLeftX) * scale;
    cnf.canvasinfo.topLeftY = y - (y - cnf.canvasinfo.topLeftY) * scale;
    cnf.canvasinfo.width *= scale; cnf.canvasinfo.height *= scale;
    updSVGSize();
    sh.Shape.wheel(scale);
    event.preventDefault();
});