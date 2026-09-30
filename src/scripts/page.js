/*
 * Page helpers: footer year, smooth scroll to the quiz, sticky mobile CTA.
 */
(function () {
  var y = document.getElementById('nbs-year');
  if (y) y.textContent = new Date().getFullYear();
  var quiz = document.getElementById('nbs-quiz');
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#nbs-quiz"]');
    if (!a || !quiz) return;
    e.preventDefault();
    window.scrollTo({ top: quiz.getBoundingClientRect().top + window.pageYOffset - 10, behavior: 'smooth' });
  });
  var sticky = document.getElementById('nbs-sticky');
  if (!sticky || !quiz || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    var e = entries[0];
    sticky.classList.toggle('is-visible', !e.isIntersecting && e.boundingClientRect.top < 0);
  }).observe(quiz);
})();
