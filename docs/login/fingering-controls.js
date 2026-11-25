// The same note editor for Student cards and Teacher pages. No Auth or storage.
export function createFingeringControls({onSave,onRetry}) {
  const element=document.createElement('div'),status=document.createElement('p'),label=document.createElement('span');
  element.className='fingering-controls';status.className='fingering-status';
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');element.append(label);
  let selected=null,hand='R',snapshot=null,index=null;
  const hands=[],fingers=[];
  function button(text,action){const node=document.createElement('button');node.type='button';node.textContent=text;node.addEventListener('click',action);element.append(node);return node;}
  function paint(){
    const note=index?.measures.flatMap(m=>m.notes).find(n=>n.noteId===selected);
    label.textContent=note?`Selected: ${note.pitch.step}${note.pitch.alter===1?'♯':note.pitch.alter===-1?'♭':''}${note.pitch.octave}`:'Select a note';
    for(const button of [...hands,...fingers,remove])button.disabled=!note||snapshot?.outcome!=='fingerings';
    for(const button of hands)button.setAttribute('aria-pressed',String(button.dataset.hand===hand));
    retry.hidden=snapshot?.drafts.find(d=>d.noteId===selected)?.status!=='unsaved';
    status.textContent=snapshot?.drafts.some(d=>d.status==='saving')?'Saving fingering…'
      :snapshot?.drafts.some(d=>d.status==='unsaved')?'Fingering unsaved. Select its note to retry. Saving requires a connection.'
      :snapshot?.outcome==='fingerings'?'Fingerings saved. Changes load when the score reopens.':'Loading latest fingerings…';
  }
  for(const side of ['L','R']){const node=button(side==='L'?'Left hand':'Right hand',()=>{hand=side;paint();});node.dataset.hand=side;hands.push(node);}
  for(let finger=1;finger<=5;finger++)fingers.push(button(String(finger),()=>onSave(selected,{kind:'set',hand,finger})));
  const remove=button('Remove number',()=>onSave(selected,{kind:'suppress'}));
  const retry=button('Retry fingering',()=>onRetry(selected));
  return {element,status,
    show(data,noteId,scoreIndex){
      snapshot=data;index=scoreIndex;
      if(noteId!==selected){const note=index?.measures.flatMap(m=>m.notes).find(n=>n.noteId===noteId);
        const value=data?.drafts.find(d=>d.noteId===noteId)?.operation??data?.overrides.find(n=>n.noteId===noteId)??note?.originalFingering;
        hand=value?.hand??(note?.staff===2?'L':'R');}
      selected=noteId;paint();
    },
    unavailable(message){snapshot=null;selected=null;index=null;paint();status.textContent=message;},
  };
}
