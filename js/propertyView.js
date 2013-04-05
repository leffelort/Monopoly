function setupProperties () {
	$(".propertyCell").click(function(){
		$(".propertyCell.selected").removeClass("selected");
		$(this).addClass("selected");
		displayPropertyDetails(this);
	});
}

function displayPropertyDetails(property) {
	console.log(property);
}