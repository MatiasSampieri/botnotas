# Cheerio Table Parser

[![License][license_badge]][license] [![Pipelines][pipelines_badge]][pipelines] [![Coverage][coverage_badge]][pipelines] [![NPM][npm_badge]][npm]

Parsing table element of Cheerio into 2D array.

## Installation

```
npm install @joshuaavalon/cheerio-table-parser
```

## Usage

```typescript
import cheerio from "cheerio";
import { parseTable } from "@joshuaavalon/cheerio-table-parser";

const dom = cheerio.load(html);
table = parseTable(dom("table")[0], {
  parser: (element) => cheerio(element).text(),
});

/*
[
  ["A", "B", "C", "D", "E"],
  ["1a", "2a", "3a", "4a", "5a"],
  ["1a", "2b", "2b", "4b", "5b"],
  ["1a", "2b", "2b", "4c", "5c"],
  ["1a", "2d", "3d", "4c", "5d"],
  ["1a", "2d", "3e", "4e", "5e"]
]
*/
```

## Known Issues

### Overlapping Cell

According to [HTML table specifications][table], it depends on how user agent render the table. Most browsers render it as overlapping cell.

However, this is not possible in this library. Therefore, it will favour `rowspan` over `colspan`.

### Handle thead, tbody, tfoot

`<thead>`, `<tbody>`, `<tfoot>` should be handled separately. This is not consider in this library. However, you can pass in `<tbody>` instead of `<table>` separately.

[license]: https://gitlab.com/joshua-avalon/cheerio-table-parser/blob/master/LICENSE
[license_badge]: https://img.shields.io/badge/license-Apache--2.0-green.svg
[pipelines]: https://gitlab.com/joshua-avalon/cheerio-table-parser/pipelines
[pipelines_badge]: https://gitlab.com/joshua-avalon/cheerio-table-parser/badges/master/pipeline.svg
[coverage_badge]: https://gitlab.com/joshua-avalon/cheerio-table-parser/badges/master/coverage.svg
[npm]: https://www.npmjs.com/package/@joshuaavalon/cheerio-table-parser
[npm_badge]: https://img.shields.io/npm/v/@joshuaavalon/cheerio-table-parser/latest.svg
[table]: https://www.w3.org/TR/html401/struct/tables.html#h-11.2.6.1
