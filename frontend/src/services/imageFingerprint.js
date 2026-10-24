export function imageFingerprint(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 8;
        const context = canvas.getContext('2d', { willReadFrequently:true });
        context.drawImage(image, 0, 0, 8, 8);
        const pixels = context.getImageData(0, 0, 8, 8).data;
        const values=[]; for(let index=0;index<pixels.length;index+=4) values.push((pixels[index]*.299)+(pixels[index+1]*.587)+(pixels[index+2]*.114));
        const average=values.reduce((sum,value)=>sum+value,0)/values.length;
        let bits=0n; values.forEach((value,index)=>{if(value>=average)bits|=1n<<BigInt(63-index);});
        resolve(bits.toString(16).padStart(16,'0'));
      } catch (error) { reject(error); } finally { URL.revokeObjectURL(url); }
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The logo image could not be read.')); };
    image.src = url;
  });
}
