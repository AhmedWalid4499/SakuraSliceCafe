/**
 * Sakura Slice Café — Table Four guestbook backend
 * ------------------------------------------------
 * Optional. The site works without this: notes are kept in each
 * visitor's own browser. Deploy this only when you want the table
 * to be SHARED — everyone seeing the same notes.
 *
 * SETUP
 *  1. Make a Google Sheet. Name the first tab "TableFour".
 *     Row 1 headers: Timestamp | Name | Note
 *  2. script.google.com → New project → paste this file.
 *  3. Put the Sheet ID below (the long id in the sheet's URL).
 *  4. Deploy → New deployment → Web app
 *       Execute as:  Me
 *       Access:      Anyone
 *  5. Copy the web-app URL into index.html:
 *       const GUESTBOOK_URL = 'https://script.google.com/macros/s/..../exec';
 */

var SHEET_ID  = 'PASTE_YOUR_SHEET_ID_HERE';
var TAB_NAME  = 'TableFour';
var MAX_NOTES = 60;   // how many notes the site shows, newest last
var MAX_LEN   = 140;  // matches the input's maxlength

function getSheet_() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_NAME);
}

/** Someone left a note on the table. */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    var text = String(body.text || '').trim().slice(0, MAX_LEN);
    var who  = String(body.who  || 'anonymous').trim().slice(0, 18) || 'anonymous';

    if (text.length < 2) {
      return json_({ ok: false, error: 'empty' });
    }

    getSheet_().appendRow([new Date(), who, text]);
    return json_({ ok: true });

  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** The site asking what's currently on the table. */
function doGet() {
  try {
    var rows = getSheet_().getDataRange().getValues();
    rows.shift(); // drop the header row

    var notes = rows
      .filter(function (r) { return String(r[2] || '').trim() !== ''; })
      .slice(-MAX_NOTES)
      .map(function (r) {
        return {
          who:  String(r[1] || 'anonymous'),
          text: String(r[2])
        };
      });

    return json_(notes);

  } catch (err) {
    return json_([]);
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
