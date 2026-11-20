import { BASE } from './config2'
// 4K UHD 纹理：直接写死，避免依赖 config2 的旧缓存值。
const W = 7680
const H = 3840

async function loadBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return createImageBitmap(await res.blob())
}

const WORKER = `
const W=${W},H=${H};
const px=lon=>(lon+180)/360*W, py=lat=>(90-lat)/180*H;
function rings(g,fn){if(!g)return;const t=g.type,c=g.coordinates;
  if(t==='LineString')fn(c);else if(t==='MultiLineString')c.forEach(fn);
  else if(t==='Polygon')c.forEach(fn);else if(t==='MultiPolygon')c.forEach(p=>p.forEach(fn));}
function drawLine(ctx,coords,color,width){
  let seg=[coords[0]];
  const flush=()=>{if(seg.length>1){ctx.beginPath();seg.forEach((p,j)=>j?ctx.lineTo(px(p[0]),py(p[1])):ctx.moveTo(px(p[0]),py(p[1])));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();}};
  for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i];if(Math.abs(b[0]-a[0])>180){flush();seg=[b];}else seg.push(b);}flush();}
self.onmessage=async(e)=>{
  const {dayBitmap, demBitmap, rivers, lakes, doShade}=e.data;
  try{
    const c=new OffscreenCanvas(W,H);
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(dayBitmap,0,0,W,H);
    if(doShade){
      const dw=demBitmap.width, dh=demBitmap.height;
      const d=new OffscreenCanvas(dw,dh);
      const dc=d.getContext('2d',{willReadFrequently:true});dc.drawImage(demBitmap,0,0);
      const dem=dc.getImageData(0,0,dw,dh).data;
      const elev=(x,y)=>dem[(Math.max(0,Math.min(dh-1,y))*dw+Math.max(0,Math.min(dw-1,x)))*4];
      const img=ctx.getImageData(0,0,W,H);
      const dst=img.data;
      for(let y=0;y<H;y++){
        const sy=Math.floor(y/H*dh);
        for(let x=0;x<W;x++){
          const sx=Math.floor(x/W*dw);
          const v=elev(sx,sy);
          if(v<=28) continue;
          const gx=elev(sx+1,sy)-elev(sx-1,sy);
          const gy=elev(sx,sy+1)-elev(sx,sy-1);
          const slope=Math.max(-40,Math.min(40,-gx*0.6-gy*0.6));
          const shade=Math.max(0.55,Math.min(1.35,1+slope/45));
          const i=(y*W+x)*4;
          dst[i]=Math.min(255,dst[i]*shade);
          dst[i+1]=Math.min(255,dst[i+1]*shade);
          dst[i+2]=Math.min(255,dst[i+2]*shade);
        }
      }
      ctx.putImageData(img,0,0);
    }
    // 不画水系：真实卫星影像里河流/湖泊本就清晰可见，额外画线反而假且无法随图层开关关闭。
    const blob=await c.convertToBlob({type:'image/jpeg',quality:0.92});
    self.postMessage({ok:true,blob});
  }catch(err){self.postMessage({ok:false,error:String(err)});}
};`

async function bake(dayUrl: string, demUrl: string, onProgress?: (s: string) => void, withHillshade = true): Promise<ImageBitmap | null> {
  try {
    onProgress?.('加载卫星影像')
    const day = await loadBitmap(dayUrl)
    onProgress?.('加载高程数据')
    const dem = await loadBitmap(demUrl)
    onProgress?.('烘焙地貌…')
    const blob = new Blob([WORKER], { type: 'text/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    const outBlob = await new Promise<Blob>((resolve, reject) => {
      worker.onmessage = e => { e.data.ok ? resolve(e.data.blob) : reject(new Error(e.data.error)); worker.terminate() }
      worker.onerror = e => { reject(new Error(e.message)); worker.terminate() }
      worker.postMessage({ dayBitmap: day, demBitmap: dem, doShade: withHillshade }, [day, dem])
    })
    onProgress?.('地貌完成')
    return createImageBitmap(outBlob)
  } catch (e) {
    onProgress?.(`烘焙失败：${String(e)}`)
    return null
  }
}

export const bakeRelief = (p?: (s: string) => void) => bake(BASE + 'textures/day.jpg', BASE + 'data/base/dem.png', p, true)
export const bakeSatellite = (p?: (s: string) => void) => bake(BASE + 'textures/day.jpg', BASE + 'data/base/dem.png', p, false)
