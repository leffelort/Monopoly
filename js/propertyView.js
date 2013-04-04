$(document).ready(function() {
	$(".propertyCell").click(function(){
		$(".propertyCell.selected").removeClass("selected");
		$(this).addClass("selected");
	});
});