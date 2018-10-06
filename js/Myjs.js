//Init Map
//*******************************************************************************************************************************************************
var lat = 41.141376;
var lng = -8.613999;
var zoom = 14;

// add an OpenStreetMap tile layer
var mbAttr = 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, ' +
	'<a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
	'Imagery © <a href="http://mapbox.com">Mapbox</a>',
	mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token=pk.eyJ1IjoicGxhbmVtYWQiLCJhIjoiemdYSVVLRSJ9.g3lbg_eN0kztmsfIPxa9MQ';


var grayscale = L.tileLayer(mbUrl, {
	id: 'mapbox.light',
	attribution: mbAttr
}),
	streets = L.tileLayer(mbUrl, {
		id: 'mapbox.streets',
		attribution: mbAttr
	});


var map = L.map('map', {
	center: [lat, lng], // Porto
	zoom: zoom,
	layers: [streets],
	zoomControl: true,
	fullscreenControl: true,
	fullscreenControlOptions: { // optional
		title: "Show me the fullscreen !",
		titleCancel: "Exit fullscreen mode",
		position: 'bottomright'
	}
});

var baseLayers = {
	"Grayscale": grayscale, // Grayscale tile layer
	"Streets": streets, // Streets tile layer
};

layerControl = L.control.layers(baseLayers, null, {
	position: 'bottomleft'
}).addTo(map);

// Initialise the FeatureGroup to store editable layers
var drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

var featureGroup = L.featureGroup();

var drawControl = new L.Control.Draw({
	position: 'bottomright',
	collapsed: false,
	draw: {
		// Available Shapes in Draw box. To disable anyone of them just convert true to false
		polyline: false,
		polygon: false,
		circle: false,
		rectangle: true,
		marker: false,
	}

});
map.addControl(drawControl); // To add anything to map, add it to "drawControl"

var dateFormat = d3.time.format("%Y-%m-%d %H:%M:%S");

//*******************************************************************************************************************************************************
//*****************************************************************************************************************************************
// Index Road Network by Using R-Tree
//*****************************************************************************************************************************************
var rt = cw(function (data, cb) {
	var self = this;
	var request, _resp;
	importScripts("js/rtree.js");
	if (!self.rt) {
		self.rt = RTree();
		request = new XMLHttpRequest();
		request.open("GET", data);
		request.onreadystatechange = function () {
			if (request.readyState === 4 && request.status === 200) {
				_resp = JSON.parse(request.responseText);
				self.rt.geoJSON(_resp);
				cb(true);
			}
		};
		request.send();
	} else {
		return self.rt.bbox(data);
	}
});

rt.data(cw.makeUrl("js/trips.json"));


//*****************************************************************************************************************************************	
//*****************************************************************************************************************************************
// Drawing Shapes (polyline, polygon, circle, rectangle, marker) Event:
// Select from draw box and start drawing on map.
//*****************************************************************************************************************************************	
map.on('draw:created', function (e) {

	var type = e.layerType,
		layer = e.layer;

	if (type === 'rectangle') {
		var bounds = layer.getBounds();
		rt.data([[bounds.getSouthWest().lng, bounds.getSouthWest().lat], [bounds.getNorthEast().lng, bounds.getNorthEast().lat]]).
			then(function (d) {
				var result = d.map(function (a) {
					return a.properties;
				});
				console.log(result);		// Trip Info: avspeed, distance, duration, endtime, maxspeed, minspeed, starttime, streetnames, taxiid, tripid
				//DrawRS(result);
				FormatData(result);
				DrawHeatMap(result);
				DrawTextbox(result);
				DrawList(result);
				DrawBarChart(result);
				DrawDonutChart(result);
				DrawScatterMatrix(result);
			});
	}
	drawnItems.addLayer(layer);			//Add your Selection to Map  
});


//*****************************************************************************************************************************************
// DrawRS Function:
// Input is a list of road segments ID and their color. Then the visualization can show the corresponding road segments with the color
// Test:      var input_data = [{road:53, color:"#f00"}, {road:248, color:"#0f0"}, {road:1281, color:"#00f"}];
//            DrawRS(input_data);
//*****************************************************************************************************************************************
function DrawRS(trips) {
	clearMap();
	for (var j = 0; j < trips.length; j++) {  // Check Number of Segments and go through all segments
		var TPT = new Array();
		TPT = TArr[trips[j].tripid].split(',');  		 // Find each segment in TArr Dictionary. 
		var polyline = new L.Polyline([]).addTo(drawnItems);
		polyline.setStyle({
			color: "rgb(86, 11, 109)",                      // polyline color
			weight: 1,                         // polyline weight
			opacity: 0.5,                      // polyline opacity
			smoothFactor: 1.0
		});
		for (var y = 0; y < TPT.length - 1; y = y + 2) {    // Parse latlng for each segment
			polyline.addLatLng([parseFloat(TPT[y + 1]), parseFloat(TPT[y])]);
		}

		//Add circle to starting point
		L.circle([parseFloat(TPT[1]), parseFloat(TPT[0])],
			10,
			{
				color: "green",
				opacity: 1,
				fillColor: "green",
				fillOpacity: .4
			})
			.addTo(drawnItems);
	}
}


//*****************************************************************************************************************************************
// FormatData Function:
//*****************************************************************************************************************************************
function FormatData(trips) {
	var hours, minutes;
	trips.forEach(function (d) {
		d["avspeed"] = +d3.format(".2f")(d["avspeed"]);
		d["distance"] = +d3.format(".2f")(d["distance"] * 0.00062137);
		d["duration"] = +d3.format(".2f")(d["duration"] / 60);
		d["endtime"] = dateFormat.parse(d["endtime"]);
		d["starttime"] = dateFormat.parse(d["starttime"]);
		d["starttime"].setSeconds(0);
		if (d.starttime.getMinutes() <= 30) {
			d["timeslot"] = (("0" + d.starttime.getHours()).slice(-2) + ":" + "00" + "-" + d.starttime.getHours() + ":" + "30");
		}
		else {
			d["timeslot"] = (("0" + d.starttime.getHours()).slice(-2) + ":" + "30" + "-" + (d.starttime.getHours() + 1) + ":" + "00");
		}
	});
}


//*****************************************************************************************************************************************
// DrawHeatMap Function:
//*****************************************************************************************************************************************
function DrawHeatMap(trips) {
	clearMap();

	var geoData = trips.map(function (d) {
		var location = [parseFloat(TArr[d.tripid].split(',')[1]), parseFloat(TArr[d.tripid].split(',')[0])];
		location.push(1);
		return location;
	});

	var heat = L.heatLayer(geoData, {
		radius: 25,
		blur: 20,
		//maxZoom: 1,
	}).addTo(drawnItems);
}


//*****************************************************************************************************************************************
// DrawTextbox Function:
//*****************************************************************************************************************************************
function DrawTextbox(trips) {
	var count = trips.length;

	//Width and height
	var margin = { top: 5, right: 5, bottom: 5, left: 5 };
	var svgWidth = 250 - margin.left - margin.right;
	var svgHeight = 200 - margin.top - margin.bottom;

	//Create SVG
	d3.select("#textbox > *").remove();

	//Create SVG element
	var svg = d3.select("#textbox")
		.append("svg")
		.attr("width", svgWidth)
		.attr("height", svgHeight)
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	//Add the SVG Text Element to the svgContainer
	svg.append("rect")
		.attr("width", svgWidth)
		.attr("height", svgHeight)
		.attr("fill", "white");

	svg.append("text")
		.attr("width", svgWidth)
		.attr("height", svgHeight)
		.text(count)
		.style("font-size", "60px")
		.attr("transform", "translate(5, 105)");
}


//*****************************************************************************************************************************************
// DrawList Function:
//*****************************************************************************************************************************************
function DrawList(trips) {

	//Columns
	var columns = ["tripid", "taxiid", "avspeed", "distance", "duration"];

	//Remove already rendered list if any
	d3.select("#list > *").remove();

	//Create List
	var table = d3.select("#list").append("table");
	var thead = table.append("thead");
	var tbody = table.append("tbody");

	// append the header row
	thead.append("tr")
		.selectAll("th")
		.data(columns)
		.enter()
		.append("th")
		.text(function (column) {
			return column;
		});

	// create a row for each object in the data
	var rows = tbody.selectAll("tr")
		.data(trips)
		.enter()
		.append("tr");

	// create a cell in each row for each column
	var cells = rows.selectAll("td")
		.data(function (row) {
			return columns.map(function (column) {
				return { column: column, value: row[column] };
			});
		})
		.enter()
		.append("td")
		.html(function (d) {
			return d.value;
		});

	table.selectAll("tbody tr")
		.on("click", function (d) {
			drawTraj(d);
		});

	table.selectAll("thead th")
		.text(function (column) {
			return column.charAt(0).toUpperCase() + column.substr(1);
		});

	//Draw trip on click of row
	function drawTraj(selectedrow) {
		clearMap();

		//Get lat long of each point in selected row
		var trip = TArr[selectedrow.tripid].split(',');

		//Draw trip on map
		var polyline = new L.Polyline([]).addTo(drawnItems);
		polyline.setStyle({
			color: "rgb(86, 11, 109)",
			weight: 3,
			opacity: 0.5,
			smoothFactor: 1.0
		});

		for (var y = 0; y < trip.length - 1; y = y + 2) {
			polyline.addLatLng([parseFloat(trip[y + 1]), parseFloat(trip[y])]);
		}

		// Add circle to starting point of trip
		L.circle([parseFloat(trip[1]), parseFloat(trip[0])],
			10,
			{
				color: "green",
				opacity: 1,
				fillColor: "green",
				fillOpacity: .4
			})
			.addTo(drawnItems);
	}
}

function clearMap() {
	for (i in map._layers) {
		//if (map._layers[i]._path != undefined) {
		if (map._layers[i]._heat != undefined || map._layers[i]._path != undefined) {
			try {
				map.removeLayer(map._layers[i]);
			} catch (e) {
				console.log("problem with " + e + map._layers[i]);
			}
		}
	}
}


//*****************************************************************************************************************************************
// DrawBarChart Function:
//*****************************************************************************************************************************************
function DrawBarChart(trips) {

	//Group by time to create bars
	var timeGroups = d3.nest()
		.key(function (d) {
			return d.timeslot;
		})
		.sortKeys(d3.ascending)
		.rollup(function (v) {
			return v.length;
		})
		.entries(trips);

	//Width and height
	var margin = { top: 5, right: 20, bottom: 5, left: 36 };
	var svgWidth = 380 - margin.left - margin.right;
	var svgHeight = 460 - margin.top - margin.bottom;

	//Create scale functions
	var xScale = d3.scale.linear()
		.range([0, svgWidth]);

	var yScale = d3.scale.ordinal()
		.rangeRoundBands([svgHeight, 0], .1);

	//Color scale
	//var colors = d3.scale.ordinal()
	//.range(d3.schemeCategory10);

	//var colors = ['#D514A5', '#D415BA', '#D415D0', '#C215D4', '#AD15D4', '#9715D4', '#8115D4', '#6B16D3', '#5616D3', '#4016D3', '#2B16D3', '#1617D3', '#162CD3', '#1642D3', '#1757D2'];


	//var colorScale = d3.scale.linear()
	////.domain([1, timeGroups.length])
	//.interpolate(d3.interpolateHcl)
	//.range([d3.rgb("#007AFF"), d3.rgb('#FFF500')]);
	//.range(["yellow", "blue"]);
	//.range([d3.rgb("#DCEDC8"), d3.rgb('#42B3D5')]);
	//.range(colors);
	//.interpolate(d3.interpolateHcl);


	//var colors = ['#84abb1', '#6c9aa1', '#538a91', '#0f8191', '#0c6d7a', '#3a7982', '#226872', '#0a5863', '#094f59', '#08434c', '#052f35', '#08464f', '#073d45', '#06343b', '#052c31', '#042327'];

	//var colorScale = d3.scale.ordinal()
	//.range(colors);

	//make y axis to show bar names
	var yAxis = d3.svg.axis()
		.scale(yScale)
		//no tick marks
		.tickSize(0)
		.orient("left");

	//Update Scales
	xScale.domain([0, d3.max(timeGroups, function (d) {
		return d.values;
	})]);

	yScale.domain(timeGroups.map(function (d) {
		return d.key;
	}));

	//Remove already rendered bar chart if any
	d3.select("#barchart > *").remove();

	//Create SVG element
	var svg = d3.select("#barchart")
		.append("svg")
		.attr("width", svgWidth + margin.left + margin.right)
		.attr("height", svgHeight + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

	var bars = svg.append('g')
		.attr("transform", "translate(20,0)")
		.selectAll("rect")
		.data(timeGroups)
		.enter()
		.append("g");

	bars.append("rect")
		.attr("x", 0)
		.attr("width", function (d) {
			return xScale(d.values);
		})
		.attr("y", function (d) {

			return yScale(d.key);
		})
		.attr("height", yScale.rangeBand())

		.attr("fill", "#325f89")
		.on("click", function (d) {
			mouseClick(d);
		});

	//add a value label to the right of each bar
	bars.append("text")
		.attr("fill", "snow")
		.style("font-weight", "bold")
		//y position of the label is halfway down the bar
		.attr("y", function (d) {
			return yScale(d.key) + yScale.rangeBand() / 2 + 4;
		})
		//x position is 3 pixels to the right of the bar
		.attr("x", function (d) {
			return xScale(d.values) - 17;
		})
		.text(function (d) {
			return d.values;
		});

	//Create Y axis
	svg.append("g")
		.attr("class", "y axis")
		.attr("transform", "translate(20,0)")
		.call(yAxis);

	function mouseClick(selectedbar) {
		var selectedTrips = [];
		for (var i = 0; i < trips.length; i++) {
			if (trips[i].timeslot == selectedbar.key) {
				selectedTrips.push(trips[i]);
			}
		}
		//console.log(selectedTrips);
		DrawHeatMap(selectedTrips);
		DrawTextbox(selectedTrips);
		DrawList(selectedTrips);
		DrawDonutChart(selectedTrips);
		DrawScatterMatrix(selectedTrips);
	}
}


//*****************************************************************************************************************************************
// DrawDonutChart Function:
//*****************************************************************************************************************************************
function DrawDonutChart(trips) {

	var streets = []
	for (var i = 0; i < trips.length; i++) {
		for (var j = 0; j < trips[i].streetnames.length; j++) {
			streets.push(trips[i].streetnames[j]);
		}
	}

	//Group by street names
	var streetGroups = d3.nest()
		.key(function (d) {
			return d;
		})

		.rollup(function (v) {
			return v.length;
		})
		.entries(streets)
		.sort(function (a, b) {
			return d3.descending(a.values, b.values);
		});

	//console.log(streetGroups);

	//Get top 10 streets
	var topStreets = [];
	for (var i = 0; i < Math.min(10, streetGroups.length); i++) {
		topStreets.push(streetGroups[i]);
	}

	//Width and height
	var margin = { top: 5, right: 20, bottom: 5, left: 10 };
	var svgWidth = 500 - margin.left - margin.right;
	var svgHeight = 460 - margin.top - margin.bottom;
	//var radius = Math.min(svgWidth, svgHeight) / 2;
	var radius = 145;

	//green colors
	//var colors = ['#84abb1', '#6c9aa1', '#538a91', '#0f8191', '#0c6d7a', '#3a7982', '#226872', '#0a5863', '#094f59', '#08434c', '#052f35', '#08464f', '#073d45', '#06343b', '#052c31', '#042327'];
	//blue
	//var colors = ['#D514A5', '#D415BA', '#D415D0', '#C215D4', '#AD15D4', '#9715D4', '#8115D4', '#6B16D3', '#5616D3', '#4016D3', '#2B16D3', '#1617D3', '#162CD3', '#1642D3', '#1757D2'];
	//purple to blue
	//var colors = ["#9D48B6", "#8F44B9", "#803FBC", "#6F3ABF", "#5B34C2", "#462FC5", "#2E29C8", "#2333CB", "#1D44CE", "#1756D1"]

	//pink to blue
	//var colors = ["#F50AE6", "#DE0AEE", "#B90AE7","#970AE0", "#770AD9", "#580AD3", "#3B0ACC", "#200AC5", "#0A0CBE", "#0A24B8"];

	//blue to pink
	//var colors = ["#0A24B8", "#0A0CBE", "#200AC5", "#3B0ACC", "#580AD3", "#770AD9", "#970AE0", "#B90AE7", "#DE0AEE", "#F50AE6"];

	//maroon to pink
	//var colors = ["#E660DD", "#D555CE", "#C44BBF", "#B442AF", "#A3399F", "#923190", "#822980", "#712270", "#601C60", "#501650"];

	//pink to maroon
	//var colors = ["#501650", "#601C60", "#712270", "#822980", "#923190", "#A3399F", "#B442AF", "#C44BBF", "#D555CE", "#E660DD"];

	//violet to blue
	var colors = ["#7299C0", "#7592C4", "#788AC8", "#7B82CC", "#837ED0", "#9282D4", "#A185D8", "#B089DC", "#C08CE0", "#CF90E4"];

	var colorScale = d3.scale.ordinal()
		//.domain([0,categories.length])
		.range(colors);

	//Remove already rendered donut chart if any
	d3.select("#donutchart > *").remove();

	//Create SVG element
	var svg = d3.select("#donutchart")
		.append("svg")
		.attr("width", svgWidth + margin.left + margin.right)
		.attr("height", svgHeight + margin.top + margin.bottom)
		.append("g")
		.attr("transform", "translate(" + 250 + "," + 240 + ")");

	// Declare an arc generator function
	var arc = d3.svg.arc()
		.innerRadius(50)
		.outerRadius(radius - 50);

	var outerArc = d3.svg.arc()
		.innerRadius(radius * 0.9)
		.outerRadius(radius * 0.9);

	var donut = d3.layout.pie()
		.sort(null)
		.value(function (d) {
			return d.values;
		});

	var donutdata = donut(topStreets);

	// Select paths, use arc generator to draw
	var arcs = svg.selectAll("path")
		.data(donutdata)
		.enter()
		.append("g");

	arcs.append("path")
		.attr("fill", function (d) {
			return colorScale(d.data.key);
		})
		.attr("d", arc)
		.on("click", function (d) {
			mouseClick(d);
		});

	// Add the text
	arcs.select("text")
		.data(donutdata)
		.enter()
		.append("text")
		.attr("text-anchor", "middle")
		.style("font-size", "12px")
		.attr("transform", function (d) {
			var pos = outerArc.centroid(d);
			pos[0] = radius * (midAngle(d) < Math.PI ? 1 : -1);
			return "translate(" + pos + ")";
		})
		.text(function (d) {
			return (d.data.key + "-" + d.value);
		});

	//Polyline to move text outside
	var polyline = svg.selectAll("polyline")
		.data(donutdata, function (d) {
			return d.data.key
		})
		.enter()
		.append("polyline")
		.attr("points", function (d) {
			var pos = outerArc.centroid(d);
			pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);

			return [arc.centroid(d), outerArc.centroid(d), pos];
		});

	function midAngle(d) {
		return d.startAngle + (d.endAngle - d.startAngle) / 2;
	}

	function mouseClick(selecteddonut) {
		//console.log(selecteddonut);
		var selectedTrips = [];
		for (var i = 0; i < trips.length; i++) {
			if (trips[i].streetnames[0] == selecteddonut.data.key || trips[i].streetnames.slice(-1)[0] == selecteddonut.data.key) {
				selectedTrips.push(trips[i]);
			}
		}
		//console.log(selectedTrips);
		DrawTextbox(selectedTrips);
		DrawRS(selectedTrips);
		DrawList(selectedTrips);
		//DrawScatterMatrix(selectedTrips);
	}
}


//*****************************************************************************************************************************************
// DrawScatterplot Function:
//*****************************************************************************************************************************************
function DrawScatterMatrix(trips) {

	//Width and height
	var svgWidth = 200;
	var svgHeight = 200;
	var padding = 20;

	//Set scales
	var x = d3.scale.linear()
		.range([padding / 2, svgWidth - padding / 2]);

	var y = d3.scale.linear()
		.range([svgHeight - padding / 2, padding / 2]);

	//Define axis
	var xAxis = d3.svg.axis()
		.scale(x)
		.orient("bottom")
		.ticks(6);

	var yAxis = d3.svg.axis()
		.scale(y)
		.orient("left")
		.ticks(6);

	var domainByTrait = {};
	var traits = d3.keys(trips[0]).filter(function (d) {
		return (d !== "endtime" && d !== "maxspeed" && d !== "minspeed" && d !== "starttime" && d !== "streetnames" && d !== "taxiid" && d !== "tripid" && d !== "timeslot");
	});
	var n = traits.length;

	traits.forEach(function (trait) {
		domainByTrait[trait] = d3.extent(trips, function (d) {
			return d[trait];
		});
	});

	xAxis.tickSize(svgWidth * n);
	yAxis.tickSize(-svgHeight * n);


	//Remove already rendered scatter matrix if any
	d3.select("#scatterplot > *").remove();
	// Clean up lost tooltips
	d3.select("#scatterplot").selectAll("div.tooltip").remove();

	//Create SVG element
	var svg = d3.select("#scatterplot")
		.append("svg")
		.attr("width", svgWidth * n + padding)
		.attr("height", svgHeight * n + padding)
		.append("g")
		.attr("transform", "translate(" + padding + "," + padding / 2 + ")");

	svg.selectAll(".x.axis")
		.data(traits)
		.enter().append("g")
		.attr("class", "x axis")
		.attr("transform", function (d, i) {
			return "translate(" + (n - i - 1) * svgWidth + ",0)";
		})
		.each(function (d) {
			x.domain(domainByTrait[d]);
			d3.select(this).call(xAxis);
		});

	svg.selectAll(".y.axis")
		.data(traits)
		.enter().append("g")
		.attr("class", "y axis")
		.attr("transform", function (d, i) {
			return "translate(0," + i * svgHeight + ")";
		})
		.each(function (d) {
			y.domain(domainByTrait[d]);
			d3.select(this).call(yAxis);
		});

	var cell = svg.selectAll(".cell")
		.data(cross(traits, traits))
		.enter().append("g")
		.attr("class", "cell")
		.attr("transform", function (d) {
			return "translate(" + (n - d.i - 1) * svgWidth + "," + d.j * svgHeight + ")";
		})
		.each(plot);

	//Add tooltip to scatterplot
	var tooltip = d3.select("#scatterplot")
		.append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);

	// Titles for the diagonal.
	cell.filter(function (d) {
		return d.i === d.j;
	})
		.append("text")
		.attr("x", padding)
		.attr("y", padding)
		.attr("dy", ".71em")
		.text(function (d) {
			return d.x;
		});

	function plot(p) {
		var cell = d3.select(this);

		x.domain(domainByTrait[p.x]);
		y.domain(domainByTrait[p.y]);

		cell.append("rect")
			.attr("class", "frame")
			.attr("x", padding / 2)
			.attr("y", padding / 2)
			.attr("width", svgWidth - padding)
			.attr("height", svgHeight - padding);

		cell.selectAll("circle")
			.data(trips)
			.enter().append("circle")
			.attr("cx", function (d) {
				return x(d[p.x]);
			})
			.attr("cy", function (d) {
				return y(d[p.y]);
			})
			.attr("r", 4)
			.style("fill", "#705591")
			/*.on("click", function (d) {
				console.log(d);
			})*/
			.on("mouseover", function (d) {
				d3.select('.tooltip')
				tooltip.html("Trip Id: " + d.tripid + "<br/> "
					+ "Average Speed: " + d.avspeed + "<br/> "
					+ "Distance: " + d.distance + "<br/>"
					+ "Duration: " + d.duration
				)
					.style("left", (d3.mouse(d3.select("#scatterplot").node())[0] + 20) + "px")
					.style("top", (d3.mouse(d3.select("#scatterplot").node())[1] - 18) + "px")
					.transition()
					.duration(200) // ms
					.style("opacity", .7);

				// transition to increase size/opacity of circle
				var circle = d3.select(this);
				circle.transition()
					.duration(800)
					.style("opacity", 1)
					.attr("r", 8)
					.ease("elastic");
			})
			.on("mouseout", function (d) {
				tooltip.transition()
					.duration(300) // ms
					.style("opacity", 0);

				// go back to original size and opacity
				var circle = d3.select(this);
				circle.transition()
					.duration(800)
					.style("opacity", .7)
					.attr("r", 4)
					.ease("elastic");

			});
	}

	function cross(a, b) {
		var c = [], n = a.length, m = b.length, i, j;
		for (i = -1; ++i < n;) for (j = -1; ++j < m;) c.push({ x: a[i], i: i, y: b[j], j: j });
		return c;
	}
}