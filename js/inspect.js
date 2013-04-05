$(document).ready(function() {
	$("#propList").css("height", document.documentElement.clientHeight + 60);
	$("#propList").load("./propertyView.html .propertyCell", function(){
		setupProperties();
	});
});