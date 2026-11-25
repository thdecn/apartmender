import {loadNotationEdition} from '../../notation/load-edition.js';
import {createFingeringControls} from '../fingering-controls.js';

export function createTeacherScore({data,studentId}) {
  const entry=document.querySelector('#teacher-score-entry'),dialog=document.createElement('dialog');
  const heading=document.createElement('h2'),close=document.createElement('button'),reload=document.createElement('button');
  const header=document.createElement('header'),area=document.createElement('div'),footer=document.createElement('footer');
  let epoch=0,view=null,pages=null,edition=null,context=null,controller=null,ready=false,reading=false,painting=0,latest=null,pageKey='';
  const editor=createFingeringControls({onSave:(id,op)=>{void view?.save(id,op);},onRetry:id=>{void view?.retry(id);}});
  dialog.className='teacher-score';dialog.setAttribute('aria-label','Student Piece fingerings');
  close.type=reload.type='button';close.textContent='Close score';reload.textContent='Reload fingerings';
  area.className='teacher-score-area';header.append(heading,close);footer.append(editor.status,reload);
  dialog.append(header,area,editor.element,footer);document.body.append(dialog);
  function reset(){epoch++;controller?.abort();view?.destroy();pages?.destroy();view=pages=null;latest=null;ready=false;reading=false;painting=0;pageKey='';
    area.replaceChildren();area.inert=false;editor.unavailable('');heading.textContent='';if(dialog.open)dialog.close();}
  close.addEventListener('click',()=>reset());dialog.addEventListener('close',()=>{if(!dialog.open&&(view||pages))reset();});
  reload.addEventListener('click',()=>{if(context)void open(context);});
  function selected(){const state=pages?.snapshot();return state?.notePages?.[state.selectedNoteId]===state.page?state.selectedNoteId:null;}
  function key(state){return `${state.page}|${state.size}|${Object.entries(state.measurePages??{}).filter(([,page])=>page===state.page).map(([id])=>id).join(',')}`;}
  function deny(message){epoch++;ready=false;reading=false;latest=context=null;painting=0;view?.destroy();view=null;pages?.destroy();pages=null;
    entry.replaceChildren();entry.hidden=true;reload.disabled=true;area.replaceChildren();area.inert=false;heading.textContent='Score unavailable';editor.unavailable(message);}
  async function paint(snapshot,expected){
    if(expected!==epoch)return;
    if(snapshot.outcome!=='fingerings'){deny('Fingering access changed. Reopen this Student after signing in.');return;}
    latest=snapshot;heading.textContent=`${snapshot.studentName?.trim()||'Student'} — ${context.piece.label}`;
    editor.show(snapshot,selected(),edition.score.index);
    const overrides=Object.fromEntries(snapshot.overrides.map(row=>[row.noteId,row]));for(const draft of snapshot.drafts)overrides[draft.noteId]=draft.operation;
    painting++;area.inert=true;
    const result=await pages.render({score:edition.score,overrides});
    if(expected!==epoch)return;painting--;if(!painting)area.inert=false;
    if(result.outcome==='error'){area.style.visibility='hidden';editor.unavailable('Score rendering failed. Reload to retry.');return;}
    if(result.outcome==='superseded')return;
    pageKey=key(result);area.style.visibility='visible';editor.show(latest,selected(),edition.score.index);
  }
  async function refresh(expected){
    if(reading||expected!==epoch||!view)return;
    reading=true;area.style.visibility='hidden';editor.unavailable('Loading latest fingerings…');
    const result=await view.refresh();
    if(expected!==epoch)return;reading=false;
    if(result.outcome==='fingerings')await paint(result,expected);
    else if(result.outcome==='fingering_access_denied')deny('Fingering access changed. Reopen this Student after signing in.');
    else editor.unavailable('Latest fingerings unavailable. Reconnect and reload.');
  }
  async function open(input){
    reset();const expected=epoch;controller=new AbortController();context=input;
    heading.textContent=`${input.student.name?.trim()||'Student'} — ${input.piece.label}`;
    editor.unavailable('Loading latest fingerings…');reload.disabled=false;area.style.visibility='hidden';dialog.showModal();
    try{
      if(edition?.version!==input.piece.notation?.version){edition?.release();edition=null;
        const loaded=await loadNotationEdition(input.piece,{signal:controller.signal});if(expected!==epoch){loaded.release();return;}edition=loaded;}
      const style=document.createElement('style');style.textContent=edition.css;area.append(style);
      const target=document.createElement('div');target.className='teacher-score-pages';area.append(target);
      pages=edition.createScorePages(target,{onSelect:()=>{if(latest)editor.show(latest,selected(),edition.score.index);},onChange:state=>{
        if(expected!==epoch||!ready||painting)return;
        if(latest)editor.show(latest,selected(),edition.score.index);
        const nextKey=key(state);if(nextKey===pageKey)return;pageKey=nextKey;
        if(state.selectedNoteId&&!selected())pages.select(null);
        void refresh(expected);
      }});
      const layout=await pages.render({score:edition.score});if(expected!==epoch)return;
      if(layout.outcome!=='pages')throw Error('Layout unavailable');pageKey=key(layout);
      view=data.createFingerings({onChange:snapshot=>{
        // Only coalesce successful snapshots: invalidation must clear immediately.
        if(ready&&(!reading||snapshot.outcome!=='fingerings'))void paint(snapshot,expected);
      }});
      // The fixed complete edition is one bounded scope: 34 measures/598 notes.
      // Refresh it on every page open/reflow, retaining all per-note pending keys.
      const result=await view.open({role:'teacher',studentId,assignmentId:input.assignment.assignmentId,index:edition.score.index,
        measureIds:edition.score.index.measures.map(m=>m.measureId)});
      if(expected!==epoch)return;
      if(result.outcome==='fingering_access_denied'){deny('This Student or Assignment is unavailable for fingering edits.');return;}
      if(result.outcome!=='fingerings')throw Error('Latest fingerings unavailable');ready=true;await paint(result,expected);
    }catch{if(expected!==epoch)return;pages?.destroy();pages=null;area.replaceChildren();editor.unavailable('Latest fingerings unavailable. Reconnect and reload.');}
  }
  return {
    clear(){reset();context=null;entry.replaceChildren();entry.hidden=true;},
    show(student,catalog){
      const assignment=student.studentId===studentId&&student.pieces.find(piece=>piece.slug==='bach-bwv-779-invention-no-8');
      const piece=assignment&&catalog.find(piece=>piece.id===assignment.slug&&piece.assetsAvailable!==false);
      if(!piece){this.clear();return;}
      context={student,piece,assignment};const button=document.createElement('button');button.type='button';button.textContent=`Open ${piece.label} score`;
      button.addEventListener('click',()=>{void open({student,piece,assignment});});entry.replaceChildren(button);entry.hidden=false;
    },
  };
}
