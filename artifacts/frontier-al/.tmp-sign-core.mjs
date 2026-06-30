import algosdk from "algosdk";
import { createPublicKey, verify as cryptoVerify } from "node:crypto";
const PFX=Buffer.from("302a300506032b6570032100","hex");
const ed=(m,s,pk)=>{try{const der=Buffer.concat([PFX,Buffer.from(pk)]);return cryptoVerify(null,Buffer.from(m),createPublicKey({key:der,format:"der",type:"spki"}),Buffer.from(s));}catch{return false;}};
function verifyAuthTxn(address,b64,nonce){
  if(!algosdk.isValidAddress(address))return false;
  let d;try{d=algosdk.decodeSignedTransaction(new Uint8Array(Buffer.from(b64,"base64")));}catch{return false;}
  if(!d.sig||d.sig.length===0)return false;
  if(d.txn.sender.toString()!==address)return false;
  const note=d.txn.note?Buffer.from(d.txn.note).toString("utf8"):"";
  if(note!==`FRONTIER-AUTH:v1:${nonce}`)return false;
  return ed(d.txn.bytesToSign(),d.sig,algosdk.decodeAddress(address).publicKey);
}
const a=algosdk.generateAccount();const address=a.addr.toString();
const nonce="deadbeef".repeat(6);const message=`FRONTIER-AUTH:v1:${nonce}`;
const sp={fee:1000,flatFee:true,firstValid:1,lastValid:1000,genesisID:"testnet-v1.0",genesisHash:"SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=",minFee:1000};
const txn=algosdk.makePaymentTxnWithSuggestedParamsFromObject({sender:address,receiver:address,amount:0,note:new TextEncoder().encode(message),suggestedParams:sp});
const blob=Buffer.from(txn.signTxn(a.sk)).toString("base64");
console.log("valid blob accepted        :",verifyAuthTxn(address,blob,nonce)===true);
console.log("replayed/wrong nonce reject:",verifyAuthTxn(address,blob,"00".repeat(24))===false);
console.log("wrong address reject       :",verifyAuthTxn(algosdk.generateAccount().addr.toString(),blob,nonce)===false);
