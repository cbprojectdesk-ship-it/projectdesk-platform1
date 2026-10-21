// A second native dialog sits above the existing form without replacing it.
// Dismissing the warning never retries a write or discards entered values.
export function showConflictWarning(message){
 if(!/overlap|capacity|clash|conflict|already.{0,30}book|workspace changed|another tab|previous change is unconfirmed/i.test(message))return false;
 let dialog=document.querySelector('#conflict-warning');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='conflict-warning';dialog.className='conflict-warning';
  dialog.setAttribute('role','alertdialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','conflict-warning-title');dialog.setAttribute('aria-describedby','conflict-warning-message');
  dialog.innerHTML='<button type="button" class="warning-close" aria-label="Close clash warning" autofocus>×</button><div class="warning-symbol" aria-hidden="true">!</div><h2 id="conflict-warning-title">This action needs your attention</h2><p id="conflict-warning-message"></p><button type="button" class="warning-return">Go back and adjust</button>';
  dialog.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>dialog.close()));
  document.body.append(dialog);
 }
 dialog.querySelector('#conflict-warning-title').textContent=/overlap|capacity|already.{0,30}book/i.test(message)?'There’s a booking clash':'This action needs your attention';
 dialog.querySelector('#conflict-warning-message').textContent=message;
 if(!dialog.open)dialog.showModal();return true;
}
