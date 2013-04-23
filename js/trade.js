$(document).ready(function() {
  window.addEventListener('load', function() {
      new FastClick(document.body);
  }, false);
  $(".playerCell").click(function() {
    $(".playerCell").removeClass("selected");
    $(this).addClass("selected");
  });
});