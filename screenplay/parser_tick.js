var fs = require('fs');
var _ = require('underscore');

var UNIQUE_DIALOG = 0;
var DEFINED_DIALOG = 0;
var EMPTY_DIALOG = 0;
var DUPLICATE_DIALOG = 0;
var MASTER_CSV = '';
var ACTORS = {};

var SRC_DIR = './stitch_src/';
var OUT_DIR = './stitch_out/';
var CSV_DIR = './stitch_csv/';

var files = [
  'cliff',
  'ferry',
  'field',
  'finale_ferry',
  'finale_lab1',
  'foyer',
  'global',
  'house',
  'lab1',
  'lab2',
  'well'
];

function parseRoom(id, done) {
  var csv = '';
  fs.readFile(SRC_DIR+id+'.xml', 'utf8', onRead);
  
  function onRead(err, data) {
    if (err) throw err;
    var count = 0;
    
    // Populate an id for all blank sound fields:
    data = data.replace(/(sound="")/g, function() {
      DEFINED_DIALOG += 1;
      var num = '000'+(count++);
      return ['sound="lib/', id, '_voice.swf:', id, '_', num.substr(-3), '"'].join('');
    });
    
    // Parse out all dialog lines:
    var diaRegEx = /<dia.+?puppet="(.+?)".+?sound="(.+?)"[\s\S]+?<en><!\[CDATA\[(.+?)\]\]><\/en>/g;
    var match = diaRegEx.exec(data);
    var uniques = {};
    var dups = {};
    
    // Add all unique dialog lines to the CSV database:
    while (match != null) {
      var actor = match[1];
      var sound = match[2];
      var text = match[3];
      if (!text) {
        EMPTY_DIALOG += 1;
        continue;
      }
      
      // Test if dialog exists in the table of unique statements:
      if (!uniques.hasOwnProperty(text)) {
        if (actor === '_avatar') actor = scenes[id];
        //if (cast.hasOwnProperty(actor)) actor = cast[actor];
        if (!ACTORS.hasOwnProperty(actor)) ACTORS[actor] = 0;
        
        uniques[text] = sound;
        text = text.replace(/&quot;/g, '""');
        text = text.replace(/&amp;/g, '&');
        csv += [id, sound, actor, '"'+text+'"'].join(',') + '\n';
        UNIQUE_DIALOG += 1;
        ACTORS[actor] += 1;
      } else {
        // Register as a duplicate if it already exists:
        dups[sound] = uniques[text];
        DUPLICATE_DIALOG += 1;
      }
      
      match = diaRegEx.exec(data);
    }
    
    // Renumber all duplicate lines with a common id:
    for (var i in dups) {
      if (dups.hasOwnProperty(i)) {
        data = data.replace('sound="'+i+'"', 'sound="'+dups[i]+'"');
      }
    }

    fs.writeFile(OUT_DIR+id+'.xml', data, onWriteXML);
  }
  
  function onWriteXML(err) {
    if (err) throw err;
    fs.writeFile(CSV_DIR+id+'.csv', csv, onWriteCSV);
  }
  
  function onWriteCSV(err) {
    if (err) throw err;
    MASTER_CSV += csv;
    done();
  }
}


function nextRoom(index, done) {
  if (index < files.length) {
    parseRoom(files[index], function() {
      nextRoom(index+1, done);
    });
  } else {
    done();
  }
}

// Load static data as base CSV, then run parser app:
fs.readFile(CSV_DIR+'static.csv', 'utf8', function(err, data) {
  if (err) throw err;
  MASTER_CSV = data;

  nextRoom(0, function() {
    console.log('Defined dialog:', DEFINED_DIALOG);
    console.log('Empty dialog:', EMPTY_DIALOG);
    console.log('Duplicate dialog:', DUPLICATE_DIALOG);
    console.log('Total unique dialog:', UNIQUE_DIALOG);
    console.log('Total actor dialog:', ACTORS);
    fs.writeFile(CSV_DIR+'master.csv', MASTER_CSV);
  });
});
