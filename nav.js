document.addEventListener('DOMContentLoaded',()=>{
  const nav=document.querySelector('nav');
  const markup=`<a href="products.html">Məhsullar</a><a href="categories.html">Kateqoriyalar</a><a href="why-alitass.html">Niyə Alitass?</a><a href="contact.html">Əlaqə</a><b>+994 50 555 11 22</b>`;
  if(nav) nav.innerHTML=markup;
  else document.querySelector('header')?.insertAdjacentHTML('afterend',`<nav class="site-nav">${markup}</nav>`);
});
