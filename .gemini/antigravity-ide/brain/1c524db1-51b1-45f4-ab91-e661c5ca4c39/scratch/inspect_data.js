async function run() {
  try {
    const resOut = await fetch('https://kss-33.vercel.app/api/outgoing');
    const out = await resOut.json();
    console.log('Outgoing items sample:', JSON.stringify(out.slice(0, 5).map(o => ({
      id: o.id,
      items: o.items.map(i => ({ materialId: i.materialId, typeMaterialId: typeof i.materialId }))
    })), null, 2));
  } catch (err) {
    console.error(err);
  }
}
run();
