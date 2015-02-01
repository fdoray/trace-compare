exports.tracecompare = tracecompare;

function tracecompare(path) {
  var tracecompare = {
  };

  // Formatters.
  var formatNumber = d3.format(',d');

  // Constants.
  var kMetricNames = {
    'a': 'duration',
    'b': 'usermode',
    'c': 'system calls',
    'd': 'interrupted',
    'e': 'wait-cpu',
    'f': 'wait-blocked',
    'g': 'timer',
    'h': 'network',
    'i': 'block-device',
    'j': 'user-input'
  };
  var kNumFilters = 2;
  var kNumBuckets = 50;

  // Available metrics with their min/max value.
  var metricsDict = {};
  var metricsArray = new Array();

  // Filters, dimensions and groups.
  var filters = new Array();
  var dimensionsProperties = {};
  var dimensions = new Array();
  var groups = new Array();
  var groupAll = new Array();

  // Charts.
  var chartsDict = {};
  var charts = new Array();

  // Load data.
  d3.json(path, function(error, data) {

    // Create an artificial metric.
    // TODO: Remove this.
    data.executions.forEach(function(d) {
      d['b'] = d['a'] * (0.5 + Math.random());
    });

    // Find available metrics and compute their min/max value.
    data.executions.forEach(function(d) {
      ForEachProperty(d, function(property) {
        if (property == 'samples')
          return;

        if (metricsDict.hasOwnProperty(property))
        {
          var metric = metricsDict[property];
          metric.min = Math.min(metric.min, d[property]);
          metric.max = Math.max(metric.max, d[property]);
        }
        else
        {
          var metric = {
            'id': property,
            'name': kMetricNames[property],
            'min': d[property],
            'max': d[property]
          };
          metricsDict[property] = metric;
          metricsArray.push(metric);
        }
      });
    });
    metricsArray.forEach(function(metric) {
      metric.bucketSize = (metric.max - metric.min) / kNumBuckets;
    });

    // Create filters and empty arrays to hold dimensions and groups.
    for (var i = 0; i < kNumFilters; ++i)
    {
      filters.push(crossfilter(data.executions));
      dimensions.push({});
      groups.push({});
      groupAll.push(filters[i].groupAll());
    }

    // Create buttons to add metric charts.
    var metricButtonsData = d3.selectAll('#metric-selector')
      .selectAll('li')
      .data(metricsArray, function(metric) { return metric.id; });
    var metricButtons = metricButtonsData.enter().append('li');
    metricButtons.text(function(metric) { return metric.name; });
    metricButtons.attr('id', function(metric) {
      return 'metric-selector-' + metric.id;
    });
    metricButtons.on('click', function(metric) {
      CreateMetricDimension(metric.id);
    });
    metricButtonsData.exit().remove();

    // Show the total.
    d3.selectAll('#total').text(formatNumber(data.executions.length));
  });

  // Creates a dimension for the specified metric.
  // @param metricId The id of the metric.
  // @returns The id of the created dimension.
  function CreateMetricDimension(metricId)
  {
    var metric = metricsDict[metricId];

    // Check whether the dimension already exists.
    if (dimensions[0].hasOwnProperty(metricId))
      return metricId;

    // Create the dimension for each filter.
    for (var i = 0; i < kNumFilters; ++i)
    {
      var dimension = filters[i].dimension(function(execution) {
        return execution[metricId];
      });
      var group = dimension.group(function(metricValue) {
        var bucketSize = metric.bucketSize;
        return Math.floor(metricValue / bucketSize) * bucketSize;
      });
      dimensions[i][metricId] = dimension;
      groups[i][metricId] = group;
    }

    dimensionsProperties[metricId] = {
      name: metric.name,
      min: metric.min,
      max: metric.max
    };

    // Hide the button used to add this dimension.
    d3.selectAll('#metric-selector-' + metricId).style('display', 'none');

    // Create the charts.
    CreateCharts(metricId);

    return metricId;
  }

  // Creates charts for the specified dimension.
  // @param The id of the dimension
  function CreateCharts(dimensionId)
  {
    // Check whether the chart already exists.
    if (chartsDict.hasOwnProperty(dimensionId))
      return;

    var dimensionProperties = dimensionsProperties[dimensionId];

    // Create the charts.
    var dimensionCharts = new Array();
    for (var i = 0; i < kNumFilters; ++i)
    {
      dimensionCharts.push(barChart()
        .dimension(dimensions[i][dimensionId])
        .group(groups[i][dimensionId])
        .x(d3.scale.linear()
            .domain([dimensionProperties.min, dimensionProperties.max])
            .rangeRound([0, 10 * kNumBuckets])));
    }

    chartsDict[dimensionId] = charts.length;
    charts.push({
      id: dimensionId,
      name: dimensionProperties.name,
      charts: dimensionCharts
    });

    ShowCharts(charts);
  }

  // Removes a dimension.
  // @param dimensionId The id of the dimension to remove.
  function RemoveDimension(dimensionId)
  {
    // Remove charts.
    charts.splice(chartsDict[dimensionId], 1);
    delete chartsDict[dimensionId];

    for (var i = 0; i < kNumFilters; ++i)
    {
      // Remove groups.
      groups[i][dimensionId].dispose();
      delete groups[i][dimensionId];

      // Remove dimensions.
      dimensions[i][dimensionId].dispose();
      delete dimensions[i][dimensionId];
    }

    // Show the button that can re-enable this dimension.
    // Note: the button only exists if its a metric dimension.
    d3.selectAll('#metric-selector-' + dimensionId).style('display', null);

    // Update the page.
    ShowCharts(charts);
  }

  // Inserts in the page the charts from the provided array.
  // @param charts Array of charts.
  function ShowCharts(charts)
  {
    var chartsData = d3.selectAll('#charts').selectAll('div.chart-container')
      .data(charts, function(chart) { return chart.id; });
    var chartsEnter = chartsData
      .enter()
      .append('div')
      .attr('class', 'chart-container');

    // Create title.
    var title = chartsEnter.append('div').attr('class', 'chart-title');
    title.append('span').text(function(chart) { return chart.name; });
    title.append('a')
      .text('Remove')
      .attr('href', '#')
      .on('click', function(chart) { RemoveDimension(chart.id); return false; });

    chartsData.exit().remove();
    chartsData.order();

  }


  return tracecompare;
}