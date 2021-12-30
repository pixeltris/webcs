# About

`zip` / `unzip` / `nuget` commands are handled by [JSZip](https://github.com/Stuk/jszip) (which is a dependency).

GitHub Pages only gzips certain file types. This project (optionally) provides decompression for a limited subset of files. These aren't project dependencies, but if compressed files are fetched it'll attempt to dynamically load the given compression lib and get stick if not found.

## Libraries

- [JSZip](https://github.com/Stuk/jszip) ((un)zip) (MIT)
- [brotlijs](https://github.com/dominikhlbg/brotlijs) (brotli (de)compress) (Apache-2.0)
- [brotli](https://github.com/google/brotli) (brotli decompress) (MIT)
- [fflate](https://github.com/101arrowz/fflate) (gzip (de)compress) (MIT)

`brotlijs` is used to make brotli compressed files which are put into the repo and `brotli` is used to decompress them. `fflate` provides the gzip algorithm which can be used as an alternative to brotli.

## File info

- JSZip
  - version: 3.7.1 | https://github.com/Stuk/jszip/blob/master/dist/jszip.min.js
  - jszip.min.js
- brotlijs
  - version: https://github.com/dominikhlbg/brotlijs/tree/d03c6330b8a9dac94f4c723f58ec3585831878ef
  - brotli.js
  - brotlijs-DictionaryBuckets (renamed from DictionaryBuckets.txt)
  - brotlijs-DictionaryHash (renamed from DictionaryHash.txt)
  - brotlijs-DictionaryWords (renamed from DictionaryWords.txt)
  - brotlijs-dictionary (renamed from dictionary.txt)
- brotli
  - version: https://github.com/google/brotli/blob/f8c671774514357abec2f6b14c8ee13c6fd885d3/js/decode.min.js
  - brotli-decode.min.js (renamed from decode.min.js)
- fflate
  - version: 0.7.2 | https://www.jsdelivr.com/package/npm/fflate
  - fflate.min.js (renamed from index.min.js)

## TODO

- Maybe pick the better of the two (gzip / brotli) at some point and remove the other?
- Consider replacing [JSZip](https://github.com/Stuk/jszip) with [zip.js](https://github.com/gildas-lormeau/zip.js) which can optionally use [fflate](https://github.com/101arrowz/fflate) / [pako](https://github.com/nodeca/pako). This might help improve performance of the `zip` / `unzip` commands.