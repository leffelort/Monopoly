$(document).ready(function() {
	$(".propertyCard").hover(function(){
		$(".titleDeed").transition({
			perspective: '800px',
			rotateY: '180deg'
		})},
		function() {
			$(".titleDeed").transition({
			perspective: '800px',
			rotateY: '0deg'
		});
	});
});