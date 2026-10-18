/* Visual preferences only. Never store tokens, credentials, or project state here. */
(function(){
  const names=['ocean','emerald','aurora','arctic','amber'];
  let selected='ocean';
  try{const cached=localStorage.getItem('ai-project-os-theme');if(names.includes(cached))selected=cached;}catch{}
  document.documentElement.setAttribute('data-theme',selected);
  document.addEventListener('DOMContentLoaded',()=>{
    const select=document.getElementById('themeSelect');if(!select)return;
    select.value=selected;
    select.addEventListener('change',()=>{
      if(!names.includes(select.value))return;
      document.documentElement.setAttribute('data-theme',select.value);
      try{localStorage.setItem('ai-project-os-theme',select.value);}catch{}
    });
  });
})();
