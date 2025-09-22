import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

// ===== Tipos =====
type UnidadMaterial = "m2" | "plancha";
type MaterialItem = { id: string; tipo: string; unidad: UnidadMaterial; precio: number; cantidad: number; };
type Tapacanto = { id: string; nombre: string; ancho_mm: number; precio_ml: number; cantidad_ml?: number };
type HerrajeSel = { id: string; nombre: string; precio_unit: number; cantidad: number; };

// Parámetros simples (sin $/h Corte, sin min/corte, sin UF)
type CosteoParams = { indirectos_pct: number; margen_pct: number; iva_pct: number; };

type Catalogo = { 
  materiales: MaterialItem[]; 
  tapacantos: Tapacanto[]; 
  herrajesSeleccionados: HerrajeSel[]; 
  flete?: number; 
};

type Resultado = { 
  materiales_detalle: { concepto: string; monto: number }[];
  indirectos: number; 
  subtotal_neto: number; 
  margen: number; 
  precio_venta: number; 
  total_con_iva: number; 
  totales: { materiales_base: number; tapacantos: number; herrajes: number; flete: number };
};

// ===== Helpers =====
const CLP = (n:number)=> new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP"}).format(Math.round(n));

// ===== Estado inicial (todo en cero) =====
const INIT_MATS: MaterialItem[] = [];
const INIT_TAPAS: Tapacanto[] = [];
const INIT_HERRAJES: HerrajeSel[] = [];
const INIT_PARAMS: CosteoParams = { indirectos_pct: 0, margen_pct: 0, iva_pct: 0 };

function calcular(cat: Catalogo, p: CosteoParams): Resultado {
  const materiales_base_total = cat.materiales.reduce((acc,it)=> acc + it.precio * it.cantidad, 0);
  const tapacantos_total = cat.tapacantos.reduce((acc,t)=> acc + t.precio_ml * (t.cantidad_ml ?? 0), 0);
  const herrajes_total = cat.herrajesSeleccionados.reduce((a,h)=> a + h.precio_unit*h.cantidad, 0);
  const flete = cat.flete ?? 0;

  const materiales_total = materiales_base_total + tapacantos_total + herrajes_total;
  const indirectos = (materiales_total) * p.indirectos_pct;
  const subtotal = materiales_total + indirectos + flete;
  const precio_venta = subtotal * (1+p.margen_pct);
  const total_con_iva = precio_venta * (1+p.iva_pct);

  return {
    materiales_detalle: [
      { concepto: "Materiales base", monto: materiales_base_total },
      { concepto: "Tapacantos", monto: tapacantos_total },
      { concepto: "Herrajes", monto: herrajes_total },
    ],
    indirectos, subtotal_neto: subtotal, margen: subtotal*p.margen_pct, precio_venta, total_con_iva,
    totales: { materiales_base: materiales_base_total, tapacantos: tapacantos_total, herrajes: herrajes_total, flete }
  };
}

export default function PresupuestoView(){
  const [catalogo, setCatalogo] = useState<Catalogo>({ materiales: INIT_MATS, tapacantos: INIT_TAPAS, herrajesSeleccionados: INIT_HERRAJES, flete: 0 });
  const [params, setParams] = useState<CosteoParams>(INIT_PARAMS);
  const resultado = useMemo(()=> calcular(catalogo, params), [catalogo, params]);

  // Materiales
  function agregarMaterial(){ 
    setCatalogo(prev=>({...prev, materiales:[...prev.materiales, { id:`mat_${Date.now()}`, tipo:"", unidad:"plancha", precio:0, cantidad:0 }]})); 
  }
  function setMatField(id:string, key: keyof MaterialItem, val:any){
    setCatalogo(prev=>({...prev, materiales: prev.materiales.map(m=> m.id===id ? {...m, [key]: (key==='precio'||key==='cantidad')? Number(val)||0 : val } : m)}));
  }
  function eliminarMaterial(id:string){
    setCatalogo(prev=>({...prev, materiales: prev.materiales.filter(m=> m.id!==id)}));
  }
  const totalMaterialesBase = catalogo.materiales.reduce((a,m)=> a + m.precio*m.cantidad, 0);

  // Tapacantos
  function agregarTapacanto(){ setCatalogo(prev=>({...prev, tapacantos:[...prev.tapacantos, { id:`tc_${Date.now()}`, nombre:"", ancho_mm:0, precio_ml:0, cantidad_ml:0 }]})); }
  function setTapField(id:string, key: keyof Tapacanto, val:any){
    setCatalogo(prev=>({...prev, tapacantos: prev.tapacantos.map(t=> t.id===id ? {...t, [key]: (key==='precio_ml'||key==='cantidad_ml'||key==='ancho_mm')? Number(val)||0 : val } : t)}));
  }
  function eliminarTapacanto(id:string){ setCatalogo(prev=>({...prev, tapacantos: prev.tapacantos.filter(t=> t.id!==id)})); }
  const totalTapacantos = catalogo.tapacantos.reduce((a,t)=> a + t.precio_ml*(t.cantidad_ml ?? 0), 0);

  // Herrajes
  function agregarHerraje(){ setCatalogo(prev=>({...prev, herrajesSeleccionados:[...prev.herrajesSeleccionados, { id:`hz_${Date.now()}`, nombre:"", precio_unit:0, cantidad:0 }]})); }
  function setHerraje(id:string, key: keyof HerrajeSel, val:any){
    setCatalogo(prev=>({...prev, herrajesSeleccionados: prev.herrajesSeleccionados.map(h=> h.id===id ? {...h,[key]: (key==='precio_unit'||key==='cantidad')? Number(val)||0 : val } : h)}));
  }
  function eliminarHerraje(id:string){ setCatalogo(prev=>({...prev, herrajesSeleccionados: prev.herrajesSeleccionados.filter(h=> h.id!==id)})); }
  const totalHerrajes = catalogo.herrajesSeleccionados.reduce((a,h)=> a + h.precio_unit*h.cantidad, 0);

  // Export helpers
  function downloadBlob(data:string, filename:string, type:string){
    const blob = new Blob([data],{type}); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  }
  function exportCSV(){
    const lines:(string|number)[][] = [];
    lines.push(["Materiales base (detalle)"]);
    lines.push(["Tipo","Unidad","Precio","Cantidad","Total"]);
    for(const m of catalogo.materiales){ lines.push([m.tipo, m.unidad, m.precio, m.cantidad, m.precio*m.cantidad]); }
    lines.push(["Total materiales base", "", "", "", totalMaterialesBase]);
    lines.push([""]); lines.push(["Tapacantos (detalle)"]);
    lines.push(["Nombre","Ancho (mm)","$/ml","Cantidad (ml)","Total"]);
    for(const t of catalogo.tapacantos){ lines.push([t.nombre, t.ancho_mm, t.precio_ml, t.cantidad_ml ?? 0, (t.precio_ml*(t.cantidad_ml ?? 0))]); }
    lines.push(["Total tapacantos","","","","", totalTapacantos]);
    lines.push([""]); lines.push(["Herrajes (detalle)"]);
    lines.push(["Nombre","$/c/u","Cantidad","Total"]);
    for(const h of catalogo.herrajesSeleccionados){ lines.push([h.nombre, h.precio_unit, h.cantidad, h.precio_unit*h.cantidad]); }
    lines.push(["Total herrajes","","","", totalHerrajes]);
    lines.push([""]); lines.push(["Totales"]);
    lines.push(["Materiales base", totalMaterialesBase]);
    lines.push(["Tapacantos", totalTapacantos]);
    lines.push(["Herrajes", totalHerrajes]);
    lines.push(["Flete", catalogo.flete ?? 0]);
    lines.push(["Indirectos", resultado.indirectos]);
    lines.push(["Subtotal", resultado.subtotal_neto]);
    lines.push(["Margen", resultado.margen]);
    lines.push(["Precio venta", resultado.precio_venta]);
    lines.push(["Total con IVA", resultado.total_con_iva]);
    const csv = lines.map(row=> row.map(v=> '\"'+ String(v).replace(/\"/g,'\"\"') +'\"').join(',')).join('\\n');
    downloadBlob('\\ufeff'+csv,'presupuesto.csv','text/csv;charset=utf-8;');
  }
  function exportJSON(){ downloadBlob(JSON.stringify({catalogo, params, resultado}, null, 2),'presupuesto.json','application/json'); }
  function exportPDF(){
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Presupuesto</title>
    <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;padding:24px}
    table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid #ddd;padding:6px;text-align:left}
    h1{font-size:18px;margin:0 0 8px}h2{font-size:14px;margin:12px 0 6px}.tot{font-weight:600}</style></head><body>
    <h1>Presupuesto</h1>
    <h2>Materiales base</h2><table><thead><tr><th>Tipo</th><th>Unidad</th><th>Precio</th><th>Cant.</th><th>Total</th></tr></thead><tbody>
    ${catalogo.materiales.map(m=>`<tr><td>${m.tipo}</td><td>${m.unidad}</td><td>${CLP(m.precio)}</td><td>${m.cantidad}</td><td>${CLP(m.precio*m.cantidad)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4">Total materiales base</td><td>${CLP(totalMaterialesBase)}</td></tr>
    </tbody></table>
    <h2>Tapacantos</h2><table><thead><tr><th>Nombre</th><th>Ancho (mm)</th><th>$/ml</th><th>Cant. (ml)</th><th>Total</th></tr></thead><tbody>
    ${catalogo.tapacantos.map(t=>`<tr><td>${t.nombre}</td><td>${t.ancho_mm}</td><td>${CLP(t.precio_ml)}</td><td>${(t.cantidad_ml??0)}</td><td>${CLP(t.precio_ml*(t.cantidad_ml??0))}</td></tr>`).join('')}
    <tr class="tot"><td colspan="4">Total tapacantos</td><td>${CLP(totalTapacantos)}</td></tr>
    </tbody></table>
    <h2>Herrajes</h2><table><thead><tr><th>Nombre</th><th>$/c/u</th><th>Cant.</th><th>Total</th></tr></thead><tbody>
    ${catalogo.herrajesSeleccionados.map(h=>`<tr><td>${h.nombre}</td><td>${CLP(h.precio_unit)}</td><td>${h.cantidad}</td><td>${CLP(h.precio_unit*h.cantidad)}</td></tr>`).join('')}
    <tr class="tot"><td colspan="3">Total herrajes</td><td>${CLP(totalHerrajes)}</td></tr>
    </tbody></table>
    <h2>Totales</h2><table><tbody>
    <tr><td>Materiales base</td><td>${CLP(totalMaterialesBase)}</td></tr>
    <tr><td>Tapacantos</td><td>${CLP(totalTapacantos)}</td></tr>
    <tr><td>Herrajes</td><td>${CLP(totalHerrajes)}</td></tr>
    <tr><td>Flete</td><td>${CLP(catalogo.flete ?? 0)}</td></tr>
    <tr><td>Indirectos</td><td>${CLP(resultado.indirectos)}</td></tr>
    <tr class="tot"><td>Subtotal neto</td><td>${CLP(resultado.subtotal_neto)}</td></tr>
    <tr><td>Margen</td><td>${CLP(resultado.margen)}</td></tr>
    <tr class="tot"><td>Precio de venta</td><td>${CLP(resultado.precio_venta)}</td></tr>
    <tr class="tot"><td>Total con IVA</td><td>${CLP(resultado.total_con_iva)}</td></tr>
    </tbody></table>
    </body></html>`;
    const w = window.open('','print'); if(!w) return; w.document.write(html); w.document.close(); w.focus(); w.print(); w.close();
  }

  return (
    <div className="p-4">
      <motion.h1 layout className="text-2xl font-bold mb-4">Presupuesto</motion.h1>

      {/* Materiales base */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Materiales base</h2>
          <button onClick={agregarMaterial} className="px-2 py-1 text-xs rounded-md bg-white text-black font-medium">Agregar material</button>
        </div>
        <div className="space-y-2">
          {catalogo.materiales.map(m => (
            <div key={m.id} className="grid grid-cols-6 gap-2 text-sm items-end">
              <FieldText label="Tipo" value={m.tipo} onChange={v=>setMatField(m.id,'tipo',v)} className="col-span-2" />
              <label className="text-sm opacity-80">
                Unidad
                <select className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2" value={m.unidad} onChange={e=>setMatField(m.id,'unidad', e.target.value as UnidadMaterial)}>
                  <option value="plancha">plancha</option>
                  <option value="m2">m2</option>
                </select>
              </label>
              <FieldNum label="Precio" value={m.precio} onChange={v=>setMatField(m.id,'precio',v)} />
              <FieldNum label="Cantidad" value={m.cantidad} onChange={v=>setMatField(m.id,'cantidad',v)} />
              <div className="text-xs">
                <div className="opacity-70">Total</div>
                <div className="font-semibold">{CLP(m.precio*m.cantidad)}</div>
              </div>
              <div className="col-span-6 flex justify-end">
                <button onClick={()=>eliminarMaterial(m.id)} className="text-xs px-2 py-1 rounded-md bg-zinc-800">Eliminar</button>
              </div>
            </div>
          ))}
          <div className="text-sm flex justify-end font-medium">Total materiales base: {CLP(totalMaterialesBase)}</div>
        </div>
      </section>

      {/* Tapacantos y Herrajes */}
      <section className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Tapacantos</h2>
            <button onClick={agregarTapacanto} className="px-2 py-1 text-xs rounded-md bg-white text-black font-medium">Agregar tapacanto</button>
          </div>
          <div className="space-y-2">
            {catalogo.tapacantos.map(t => (
              <div key={t.id} className="grid grid-cols-5 gap-2 text-sm items-end">
                <div className="col-span-2"><FieldText label="Nombre" value={t.nombre} onChange={v=>setTapField(t.id,'nombre',v)} /></div>
                <FieldNum label="Ancho (mm)" value={t.ancho_mm} onChange={v=>setTapField(t.id,'ancho_mm',v)} />
                <FieldNum label="$ / ml" value={t.precio_ml} onChange={v=>setTapField(t.id,'precio_ml',v)} />
                <FieldNum label="Cantidad (ml)" value={t.cantidad_ml ?? 0} onChange={v=>setTapField(t.id,'cantidad_ml',v)} />
                <div className="col-span-5 flex items-center gap-2">
                  <div className="text-xs opacity-70">Total</div>
                  <div className="font-medium">{CLP(t.precio_ml*(t.cantidad_ml ?? 0))}</div>
                  <button onClick={()=>eliminarTapacanto(t.id)} className="ml-auto text-xs px-2 py-1 rounded-md bg-zinc-800">Eliminar</button>
                </div>
              </div>
            ))}
            <div className="text-sm flex justify-end font-medium">Total tapacantos: {CLP(totalTapacantos)}</div>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Herrajes</h2>
            <button onClick={agregarHerraje} className="px-2 py-1 text-xs rounded-md bg-white text-black font-medium">Agregar nuevo herraje</button>
          </div>
          <div className="space-y-2">
            {catalogo.herrajesSeleccionados.length===0 && (<div className="text-xs opacity-70">No hay herrajes. Usa el botón para agregar.</div>)}
            {catalogo.herrajesSeleccionados.map(h=> (
              <div key={h.id} className="bg-zinc-900 border border-zinc-700 rounded-lg p-2 grid md:grid-cols-5 gap-2 items-end text-sm">
                <FieldText label="Nombre" value={h.nombre} onChange={(v)=>setHerraje(h.id,'nombre',v)} />
                <FieldNum label="$ c/u" value={h.precio_unit} onChange={(v)=>setHerraje(h.id,'precio_unit',v)} />
                <FieldNum label="Cantidad" value={h.cantidad} onChange={(v)=>setHerraje(h.id,'cantidad',v)} />
                <div className="md:col-span-2 flex items-center gap-2">
                  <div className="opacity-70 text-xs">Total</div>
                  <div className="font-medium">{CLP(h.precio_unit*h.cantidad)}</div>
                  <button onClick={()=>eliminarHerraje(h.id)} className="ml-auto text-xs px-2 py-1 rounded-md bg-zinc-800">Eliminar</button>
                </div>
              </div>
            ))}
            <div className="text-sm flex justify-end font-medium">Total herrajes: {CLP(totalHerrajes)}</div>
          </div>
        </div>
      </section>

      {/* Totales */}
      <section className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 mb-6">
        <h2 className="font-semibold mb-4">Totales</h2>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <FieldNum label="% Indirectos" value={params.indirectos_pct*100} onChange={(v)=>setParams(prev=>({...prev, indirectos_pct:v/100}))} suffix="%" />
            <FieldNum label="% Margen" value={params.margen_pct*100} onChange={(v)=>setParams(prev=>({...prev, margen_pct:v/100}))} suffix="%" />
            <FieldNum label="IVA %" value={params.iva_pct*100} onChange={(v)=>setParams(prev=>({...prev, iva_pct:v/100}))} suffix="%" />
            <FieldNum label="Flete (CLP)" value={catalogo.flete ?? 0} onChange={(v)=>setCatalogo(prev=>({...prev, flete:v}))} />
          </div>
          <div className="space-y-2">
            <Line label="Materiales base" value={CLP(resultado.totales.materiales_base)} />
            <Line label="Tapacantos" value={CLP(resultado.totales.tapacantos)} />
            <Line label="Herrajes" value={CLP(resultado.totales.herrajes)} />
            <Line label="Indirectos" value={CLP(resultado.indirectos)} />
            <Line label="Flete" value={CLP(resultado.totales.flete)} />
            <Line label="Subtotal neto" value={CLP(resultado.subtotal_neto)} strong />
            <Line label="Margen" value={CLP(resultado.margen)} />
            <Line label="Precio de venta" value={CLP(resultado.precio_venta)} strong />
            <Line label="Total con IVA" value={CLP(resultado.total_con_iva)} strong />
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={exportPDF} className="px-3 py-2 rounded-xl bg-white text-black text-sm font-semibold">PDF</button>
              <button onClick={exportCSV} className="px-3 py-2 rounded-xl bg-zinc-800 text-sm">Excel (CSV)</button>
              <button onClick={exportJSON} className="px-3 py-2 rounded-xl bg-zinc-800 text-sm">JSON</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ===== UI Helpers =====
function Line({label, value, strong}:{label:string; value:string; strong?:boolean}){
  return (<div className="flex items-center justify-between"><span className={`opacity-80 ${strong?'font-semibold':''}`}>{label}</span><span className={`tabular-nums ${strong?'font-semibold':''}`}>{value}</span></div>);
}
function FieldText({label, value, onChange, className}:{label:string; value:string; onChange:(v:string)=>void; className?:string}){
  return (<label className={`text-sm opacity-80 ${className||''}`}>{label}<input className="mt-1 w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2" value={value} onChange={(e)=>onChange(e.target.value)} /></label>);
}
function FieldNum({label, value, onChange, suffix, className}:{label:string; value:number; onChange:(v:number)=>void; suffix?:string; className?:string}){
  return (<label className={`text-sm opacity-80 ${className||''}`}>{label}<div className="mt-1 flex items-center gap-2"><input type="number" className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-right" value={Number.isFinite(value)?value:0} onChange={(e)=>onChange(Number(e.target.value))} />{suffix && <span className="text-xs opacity-70">{suffix}</span>}</div></label>);
}
