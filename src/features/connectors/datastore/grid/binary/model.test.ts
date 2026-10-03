import {describe,it,expect} from 'bun:test';
import {nativeBinaryValue,decodeBinaryPrefix,decodeCompleteBinary,binaryHexRows,parseBinaryHexSearch,findBinaryBytes,binaryUtf8Preview,binaryDownloadName,BINARY_DOWNLOAD_BYTES} from './model';
import {identifyBinaryImage} from './image';
const wire=(value:string)=>({type:'binary',base64:value});
describe('native binary cell preview P0',()=>{
 it('preserves null/empty and strict canonical byte payloads',()=>{
   expect(nativeBinaryValue(null)).toBeNull(); expect(nativeBinaryValue('')).toBeNull();
   expect(nativeBinaryValue(wire(''))?.bytes).toBe(0);
   const value=nativeBinaryValue(wire('AP9B5Lit'))!;expect(value.bytes).toBe(6);
   expect([...decodeCompleteBinary(value)]).toEqual([0,255,65,228,184,173]);
   expect(()=>nativeBinaryValue(wire('AB=='))).toThrow();
   expect(()=>nativeBinaryValue(wire('A==='))).toThrow();expect(()=>nativeBinaryValue(wire('bad\n'))).toThrow();
   const original=wire('AP9B');expect(decodeBinaryPrefix(nativeBinaryValue(original)!,2)).toEqual(new Uint8Array([0,255]));expect(original.base64).toBe('AP9B');
 });
 it('has exact offsets, byte search and explicit UTF8 boundaries',()=>{
   const bytes=Uint8Array.from({length:40},(_,i)=>i+32);const rows=binaryHexRows(bytes,1,1);
   expect(rows[0]).toEqual({offset:'00000010',hex:'30 31 32 33 34 35 36 37 38 39 3A 3B 3C 3D 3E 3F',ascii:'0123456789:;<=>?'});
   expect(findBinaryBytes(bytes,parseBinaryHexSearch('2f 30'),0)).toBe(15);expect(findBinaryBytes(bytes,parseBinaryHexSearch('2f30'),16)).toBe(15);
   expect(()=>parseBinaryHexSearch('A')).toThrow();expect(()=>parseBinaryHexSearch('GG')).toThrow();
   expect(binaryUtf8Preview(new Uint8Array([228,184]),false)).toBeNull();expect(binaryUtf8Preview(new Uint8Array([228,184]),true)).toBe('');
   expect(binaryUtf8Preview(new Uint8Array([255]),true)).toBeNull();expect(binaryUtf8Preview(new TextEncoder().encode('中文😀'),false)).toBe('中文😀');
   expect(()=>decodeCompleteBinary({bytes:BINARY_DOWNLOAD_BYTES+1,base64:''})).toThrow();expect(binaryDownloadName('../CON')).not.toContain('/');
 });
 it('admits bounded raster headers and rejects active/oversized content',()=>{
   const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,2]);expect(identifyBinaryImage(png)).toMatchObject({mimeType:'image/png',width:1,height:2});
   const view=new DataView(png.buffer);view.setUint32(16,100000);view.setUint32(20,100000);expect(identifyBinaryImage(png)).toBeNull();
   expect(identifyBinaryImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>'))).toBeNull();
   expect(identifyBinaryImage(new Uint8Array([255,216,255,192,0,1]))).toBeNull();
   const gif=new TextEncoder().encode('GIF89a\x01\x00\x02\x00');expect(identifyBinaryImage(gif)).toMatchObject({mimeType:'image/gif',width:1,height:2});
 });
});
