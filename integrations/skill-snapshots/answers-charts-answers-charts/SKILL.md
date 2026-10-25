---
name: answers-charts
description: "Use when a chart would communicate a categorical comparison, trend, composition, or numeric relationship more clearly than prose."
---

# Charts

## `charts_widget_v2`

Render exactly one polished JSON-backed bar, line, pie, or scatter chart in
ChatGPT for categorical comparisons, trends, part-to-whole composition, and
numeric relationships.

Put the complete chart specification under the required `content` argument.
Never place `chartType`, `meta`, `data`, or other chart-spec fields directly in
the `charts_widget_v2` argument object.

Invocation:
// Insert directly:
genui{"charts_widget_v2": {"content": {...}}}
// This widget is not eligible for UUID Mode.

Example:
genui{"charts_widget_v2":{"content":{"chartType":"bar","meta":{"title":"Weekly coffee","description":"Cups of coffee consumed by day."},"xKey":"day","series":[{"dataKey":"cups","label":"Cups","valueFormat":"integer"}],"data":[{"day":"Mon","cups":2},{"day":"Tue","cups":3}]}}}

Args schema:
```text
// ChartsWidgetV2Parameters
{
// Content
//
// Goal:
// Return a chart spec as a valid JSON object for exactly one polished bar, line, pie, or scatter chart visualization.
//
// Use this widget only when:
// - The user wants a bar chart, line chart, pie chart, scatter chart, categorical comparison, ranked comparison, ordered trend, part-to-whole composition, or relationship between two numeric variables.
// - A chart materially improves comprehension over a text summary.
// - Use bar charts for categorical comparisons, rankings, top-N lists, and unordered or independent buckets where relative magnitude or precise comparison matters. Use stacked bars for part-to-whole comparisons across categories.
// - Use line charts for time series, ordered progression, trends, cumulative movement, or any x-axis where point order carries the main meaning.
// - For time series, retrieve and plot one data point for each period in the user's requested range when available; never replace the series with a single aggregate.
// - For comparisons between rates or metrics that usually change over time, like inflation vs interest rates, prefer a line chart unless the user asks for categories or correlation.
// - Use pie charts for one-time part-to-whole composition where slices add up to a meaningful total and there are only a few categories.
// - Use scatter charts for correlation, distribution, or relationship prompts where each row is one observation with numeric x and y values.
// - Do not use it for 3D scenes, maps, tables, flow diagrams, bubble charts, or arbitrary Recharts/React code.
// - Avoid using it for mathematical functions, equations, formula curves, or coordinate-plane algebra/calculus plots such as `y = x^2` or `f(x) = sin(x)`; prefer the graphable-function learning block for those cases.
//
// Runtime you already have:
// - A prebuilt Recharts renderer owns the card, responsive layout, axes, grids, tooltips, styling, colors, legends, hover states, number formatting, and dark mode.
// - It accepts exactly one spec object with `chartType`, `meta`, `data`, and chart field mappings.
//
// Spec format:
// - `chartType`: one of `"bar"`, `"line"`, `"pie"`, or `"scatter"`.
// - `meta`: object with `title`, `description`, and optional `footer`.
// - `xKey`: stable internal data key for the x-axis. Use a simple key like `year`, `category`, `company`, or `adSpend`; do not use this field as display copy.
// - `xAxisScale`: optional. Include only as `"linear"` for a line chart whose `data[*][xKey]` values are finite numbers and whose numeric distances should determine point spacing. Omit it otherwise; never emit a categorical or default value.
// - `xAxisLabel`: optional short sentence case human-facing label for the x-axis title when it improves interpretation or the user explicitly requests one.
// - Temporal x-axis values in `data[*][xKey]` are rendered directly as tick and tooltip labels. Prefer localized, user-friendly labels over raw ISO-8601 strings like `2026-06-04`, unless the user explicitly asks for ISO dates or the source labels must be preserved exactly.
// - `series`: array of one or more series objects for bar, line, and scatter charts. Each series object has `dataKey`, optional `label`, optional `axisLabel`, optional `valueFormat`, optional `valuePrefix`, and optional `valueSuffix`.
// - `series[].stack`: optional nonempty string for bar charts. Equal values stack series together; different values create separate stacks. Omit it for side-by-side bars. Stack only compatible, additive values with consistent formatting. Use `stack`, not `stackId` or top-level `stacked`.
// - `yAxisMin` and `yAxisMax`: optional finite numeric lower and upper bounds for the single y-axis in bar, line, and scatter charts. Either bound may be specified independently. When present, the runtime calculates the y-axis ticks from the pinned bound.
// - `valueFormat`: use `"compact"` for large values, `"integer"` for whole-number counts, or `"raw"` when the value should not be reformatted.
// - When using `valueSuffix: "%"`, put percentage-point values in `data`: use `42` for `42%` and `0.42` only when the intended label is `0.42%`. Do not use unit fractions for percentages.
// - `layout`: optional `"vertical"` for horizontal bar charts.
// - `nameKey` and `valueKey`: required for pie charts. `nameKey` identifies slice labels and `valueKey` identifies slice values.
// - `data`: array of inline data row objects.
//
// Authoring model:
// - Set `content` to the chart spec object directly. Do not stringify the chart spec, escape its quotes, or wrap it in another object.
// - Keep `chartType`, `meta`, chart mappings, and `data` inside `content`; do not place them alongside `content`.
// - The chart patterns below are values for `content`, not complete invocations.
// - Chart user-provided data, reliably known facts, computed values, proposed schedules or plans, and clearly labeled estimates or illustrative values as appropriate to the request. Never invent external facts or present estimates as measured data.
// - Preserve all relevant, already-found data rows at the user's requested granularity. Do not omit, sample, truncate, thin, or aggregate them merely for brevity or visual simplicity.
// - Return only valid JSON. Use double quotes for all object keys and strings. Do not use trailing commas.
// - Emit fields in this order so the preview can render progressively while streaming: `chartType`, `meta`, chart mappings (`xKey`, `xAxisScale`, `xAxisLabel`, `series`, `yAxisMin`, `yAxisMax`, `layout`, `nameKey`, `valueKey`), then `data` last.
// - When multiple distinct charts are necessary, invoke this chart component once per chart. Do not pack multiple charts into one spec.
// - Prefer one series by default for bar and line charts. Use multiple series only when the comparison is genuinely easier to read that way.
// - For 100% stacked bars, use percentage-point values totaling 100 per category, `valueSuffix: "%"`, `yAxisMin: 0`, and `yAxisMax: 100`.
// - Prefer one y-series for scatter charts. Use multiple scatter series only when all y-series share the same x variable and comparable units.
// - Omit `yAxisMin` and `yAxisMax` by default. Include them only when the user requests a fixed y-axis range or the chart context makes a fixed baseline or ceiling meaningful. Use them only when every series shares one y-axis scale and compatible units; do not use them for pie charts or charts with multiple y-axis scales. When both are present, `yAxisMin` must be less than `yAxisMax`. When choosing both bounds for integer data, prefer an integer tick step `(yAxisMax-yAxisMin)/4` without excluding data.
// - Omit `xAxisScale` by default. Set it to `"linear"` only for line charts with numeric x-values where proportional spacing matters, such as irregularly spaced years or elapsed time. Do not include it for categorical axes, evenly spaced labels, bar charts, pie charts, or scatter charts, and never emit `"category"`.
// - Use strings for numeric-looking x-axis labels (years, postal codes, IDs, versions), preserving leading zeros and notation. Use numbers for quantities and years requiring proportional spacing.
// - Use top-level `xAxisLabel` when the x-axis needs a short human-facing label, especially for scatter charts and numeric x variables. Prefer labels like `Ad spend`, `Age`, `Price`, `Year`, or `Company`. Keep `xKey` as an internal key and do not recase it to create display text.
// - For time-based x-axes, choose label granularity from the chart context and keep labels concise. Prefer concise, user-friendly localized date labels over raw ISO dates or long comma-separated dates. For English labels, use examples like `Jun 4` for day-level data, `4 Jun 2026` when a full date needs a year, `Jun 2026` for month-level data, and years for annual data.
// - Use `series[].axisLabel` for a short human-facing y-axis title when it improves interpretation or the user explicitly requests one. Prefer short sentence case measured quantities when one clear measure exists, such as `Revenue`, `Population`, `Count`, or `Policy interest rate`. Use a unit label such as `Percent` or `USD` when multiple different measures intentionally share one y-axis and the unit is the clearest common label. Use `valuePrefix` and `valueSuffix` to control tick and tooltip formatting. Use the same `axisLabel` on series that should share one y-axis.
// - Let the runtime assign default colors for ordinary bars, lines, pie slices, and scatter points. Do not include color fields.
// - Favor a clear x-axis key like `year`, `category`, or `company` and a single y-axis measure like `count`, `revenue`, or `percentage`.
// - Capitalize the first letter of short model-authored display labels like `meta.title` and `series[].label`; preserve source/canonical casing and keep descriptions and footers sentence case.
// - Do not recase internal keys (`dataKey`, `xKey`, `nameKey`, `valueKey`) or copied data values.
// - Use a scatter chart for relationships like height versus weight, price versus rating, or ad spend versus revenue. Do not use scatter for ordered time series; use a line chart instead.
// - Use a pie chart only for proportions or shares of a single total at one point in time. Prefer a bar chart when there are more than about 6 slices, when exact ranking matters, or when categories do not sum to a meaningful whole.
// - Do not use pie charts for time series, change over time, cumulative movement, or ordered x-axes; use a line chart instead.
// - For bar charts with 6 or more bars, set `layout` to `"vertical"` to create a horizontal bar chart. Otherwise, omit `layout` and use the default column-style bar chart.
// - For time-based or otherwise ordered x-axes, prefer a line chart unless the user specifically asks to compare discrete bucket totals.
// - For line charts over multi-year periods, choose enough temporal granularity to show the shape of the trend. Prefer monthly or quarterly points when the data is available or when using clearly labeled estimates; use annual points only when the user asks for annual data or only annual data is known.
//
// Quality bar:
// - Make the first frame legible, calm, and presentation-ready, with one clear message, consistent spacing, restrained colors, readable axis labels, and compact formatting for large values.
// - Do not truncate or auto-skip meaningful category labels.
//
// Hard constraints:
// - Exactly one chart per invocation of this chart component.
// - Do not emit JavaScript, JSX, imports, exports, functions, hooks, network requests, markdown, or prose.
// - Do not build your own outer card or page layout. The runtime owns presentation.
//
// Valid bar chart pattern:
// `{"chartType":"bar","meta":{"title":"Orders by quarter","description":"Illustrative new and repeat orders."},"xKey":"quarter","series":[{"dataKey":"new","label":"New","stack":"total"},{"dataKey":"repeat","label":"Repeat","stack":"total"}],"data":[{"quarter":"Q1","new":40,"repeat":60},{"quarter":"Q2","new":50,"repeat":80}]}`
//
// Valid line chart pattern:
// `{"chartType":"line","meta":{"title":"Monthly revenue","description":"Illustrative revenue trend."},"xKey":"month","xAxisLabel":"Month","series":[{"dataKey":"revenue","label":"Revenue","axisLabel":"Revenue","valueFormat":"compact","valuePrefix":"$"}],"data":[{"month":"Jan","revenue":120000},{"month":"Feb","revenue":128000}]}`
//
// Valid linear x-axis line chart pattern:
// `{"chartType":"line","meta":{"title":"Population estimates","description":"Illustrative estimates at irregular intervals."},"xKey":"year","xAxisScale":"linear","series":[{"dataKey":"population","label":"Population","valueFormat":"compact"}],"data":[{"year":2000,"population":500000},{"year":2005,"population":520000},{"year":2023,"population":610000}]}`
//
// Valid pie chart pattern:
// `{"chartType":"pie","meta":{"title":"Revenue mix","description":"Illustrative revenue shares."},"nameKey":"segment","valueKey":"revenue","series":[{"dataKey":"revenue","label":"Revenue","valueFormat":"compact","valuePrefix":"$"}],"data":[{"segment":"Enterprise","revenue":5200000},{"segment":"Consumer","revenue":3100000}]}`
//
// Valid scatter chart pattern:
// `{"chartType":"scatter","meta":{"title":"Ad spend vs revenue","description":"Illustrative monthly observations."},"xKey":"adSpend","xAxisLabel":"Ad spend","series":[{"dataKey":"revenue","label":"Revenue","valueFormat":"compact","valuePrefix":"$"}],"data":[{"adSpend":24000,"revenue":180000},{"adSpend":28000,"revenue":194000}]}`
//
// Valid horizontal bar chart pattern:
// `{"chartType":"bar","meta":{"title":"GDP by country","description":"Illustrative GDP in trillions of USD."},"layout":"vertical","xKey":"country","series":[{"dataKey":"gdp","label":"GDP","valueFormat":"raw","valuePrefix":"$","valueSuffix":"T"}],"data":[{"country":"Country A","gdp":2.9},{"country":"Country B","gdp":1.7}]}`
content: { [key: string]: any },
}
```

