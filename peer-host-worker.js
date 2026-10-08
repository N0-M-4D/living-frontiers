/* The host's simulation is isolated from renderer globals and client commands. */
'use strict';
importScripts('fog.js','simulation.js','geography.js','terrain.js','world.js','territory.js','save-validation.js','campaign.js','multiplayer-match.js');
let match=null,interval=null,ticks=0;
function publish(){
 for(const side of ['blue','red'])postMessage({type:'snapshot',side,snapshot:FrontierMatch.snapshotFor(match,side)});
}
function stop(){clearInterval(interval);interval=null;}
onmessage=({data})=>{
 try{
  if(data.type==='start'&&!match){
   match=FrontierMatch.createMatch({seed:data.seed,mode:'short'});publish();
   interval=setInterval(()=>{
    try{FrontierMatch.stepMatch(match,.05);if(++ticks%4===0||match.winner)publish();if(match.winner)stop();}
    catch{stop();postMessage({type:'fatal',message:'The host simulation stopped. Create a new match.'});}
   },50);
  }else if(data.type==='command'&&match&&['blue','red'].includes(data.side)){
   const commands=data.commands;
   if(!Array.isArray(commands)||commands.length>60)return;
   for(const command of commands){const result=FrontierMatch.applyCommand(match,data.side,command);if(!result.ok)postMessage({type:'error',side:data.side,message:result.message});}
   postMessage({type:'processed'});
  }else if(data.type==='stop'){stop();match=null;}
 }catch{stop();postMessage({type:'fatal',message:'Unable to run this match. Create a new invite.'});}
};
