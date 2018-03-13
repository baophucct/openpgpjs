// GPG4Browsers - An OpenPGP implementation in javascript
// Copyright (C) 2011 Recurity Labs GmbH
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 3.0 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

/**
 * @requires pako
 * @requires config
 * @requires enums
 * @requires util
 * @requires compression/bzip2
 */

import pako from 'pako';
import config from '../config';
import enums from '../enums';
import util from '../util';
import Bzip2 from '../compression/bzip2.build.js';

/**
 * Implementation of the Compressed Data Packet (Tag 8)
 *
 * {@link https://tools.ietf.org/html/rfc4880#section-5.6|RFC4880 5.6}:
 * The Compressed Data packet contains compressed data.  Typically,
 * this packet is found as the contents of an encrypted packet, or following
 * a Signature or One-Pass Signature packet, and contains a literal data packet.
 * @memberof module:packet
 * @constructor
 */
function Compressed() {
  /**
   * Packet type
   * @type {module:enums.packet}
   */
  this.tag = enums.packet.compressed;
  /**
   * List of packets
   * @type {module:packet.List}
   */
  this.packets = null;
  /**
   * Compression algorithm
   * @type {compression}
   */
  this.algorithm = 'zip';

  /**
   * Compressed packet data
   * @type {String}
   */
  this.compressed = null;
}

/**
 * Parsing function for the packet.
 * @param {String} bytes Payload of a tag 8 packet
 */
Compressed.prototype.read = function (bytes) {
  // One octet that gives the algorithm used to compress the packet.
  this.algorithm = enums.read(enums.compression, bytes[0]);

  // Compressed data, which makes up the remainder of the packet.
  this.compressed = bytes.subarray(1, bytes.length);

  this.decompress();
};


/**
 * Return the compressed packet.
 * @returns {String} binary compressed packet
 */
Compressed.prototype.write = function () {
  if (this.compressed === null) {
    this.compress();
  }

  return util.concatUint8Array([new Uint8Array([enums.write(enums.compression, this.algorithm)]), this.compressed]);
};


/**
 * Decompression method for decompressing the compressed data
 * read by read_packet
 */
Compressed.prototype.decompress = function () {

  if (!decompress_fns[this.algorithm]) {
    throw new Error("Compression algorithm unknown :" + this.algorithm);
  }

  this.packets.read(decompress_fns[this.algorithm](this.compressed));
};

/**
 * Compress the packet data (member decompressedData)
 */
Compressed.prototype.compress = function () {

  if (!compress_fns[this.algorithm]) {
    throw new Error("Compression algorithm unknown :" + this.algorithm);
  }

  this.compressed = compress_fns[this.algorithm](this.packets.write());
};

export default Compressed;

//////////////////////////
//                      //
//   Helper functions   //
//                      //
//////////////////////////


const nodeZlib = util.getNodeZlib();
const Buffer = util.getNodeBuffer();

function node_zlib(func, options = {}) {
  return function (data) {
    return func(data, options);
  };
}

function pako_zlib(constructor, options = {}) {
  return function(data) {
      const obj = new constructor(options);
      obj.push(data, true);
      return obj.result;
  };
}

let compress_fns;
let decompress_fns;
if (nodeZlib) { // Use Node native zlib for DEFLATE compression/decompression
  compress_fns = {
    // eslint-disable-next-line no-sync
    zip: node_zlib(nodeZlib.deflateRawSync, { level: config.deflate_level }),
    // eslint-disable-next-line no-sync
    zlib: node_zlib(nodeZlib.deflateSync, { level: config.deflate_level }),
    bzip2: Bzip2.compressFile
  };

  decompress_fns = {
    // eslint-disable-next-line no-sync
    zip: node_zlib(nodeZlib.inflateRawSync),
    // eslint-disable-next-line no-sync
    zlib: node_zlib(nodeZlib.inflateSync),
    bzip2: Bzip2.decompressFile
  };
} else { // Use JS fallbacks
  compress_fns = {
    zip: pako_zlib(pako.Deflate, { raw: true, level: config.deflate_level }),
    zlib: pako_zlib(pako.Deflate, { level: config.deflate_level }),
    bzip2: Bzip2.compressFile
  };

  decompress_fns = {
    zip: pako_zlib(pako.Inflate, { raw: true }),
    zlib: pako_zlib(pako.Inflate),
    bzip2: Bzip2.decompressFile
  };
}
