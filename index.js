/*
 * OS.js - JavaScript Cloud/Web Desktop Platform
 *
 * Copyright (c) 2011-2020, Anders Evenrud <andersevenrud@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * @author  Anders Evenrud <andersevenrud@gmail.com>
 * @licence Simplified BSD License
 */

// https://developers.google.com/api-client-library/javascript/reference/referencedocs
// https://developers.google.com/drive/api/v3/quickstart/js
// https://developers.google.com/drive/api/v3/reference/files#resource
// https://developers.google.com/drive/api/v3/manage-downloads
// https://developers.google.com/drive/api/v2/about-auth

// TODO: Cache
// TODO: Try to auto-resolve paths if no parent_id given
// TODO: The rest of the adapter methods

const checkIfFile = file => file.mimeType !== 'application/vnd.google-apps.folder' || file.kind !== 'drive#file';

// Gets basename of a path
const basename = path => path.split('/').reverse()[0];

// File listing generator
async function* asyncFileList(gapi, query) {
  let nextPageToken;

  while (true) {
    const {result} = await gapi.client.drive.files.list({
      pageToken: nextPageToken,
      pageSize: 1000,
      fields: 'nextPageToken, files',
      q: query
    });

    nextPageToken = result.nextPageToken;

    yield result.files;

    if (!nextPageToken) {
      break;
    }
  }
}

// File listing handler
async function fileList(core, gapi, root, options) {
  const {pathJoin} = core.make('osjs/fs');
  const query = root.id ? `'${root.id}' in parents` : null;
  let list = [];

  for await (const result of asyncFileList(gapi, query)) {
    const addition = result
      .filter(file => file.isAppAuthorized === true)
      .map(file => {
        const isFile = checkIfFile(file);
        return {
          isFile,
          isDirectory: !isFile,
          mime: isFile ? file.mimeType : null,
          size: isFile ? parseInt(file.size, 10) : null,
          path: pathJoin(root.path, file.name),
          filename: file.name,
          id: file.id,
          parent_id: root.id || file.parents[0],
          stat: {}
        };
      });

    list = list.concat(addition);
  }

  return list;
}

// Check if valid input file
const checkFile = file => file.id
  ? Promise.resolve(file)
  : Promise.reject(new Error('Invalid gdrive file'));

// Checks if a response is an error
const checkResponse = response => response.error
  ? Promise.reject(new Error(response.error.message))
  : Promise.resolve(response.result);

// Check the download response
const checkDownloadResponse = (response, file) => response.ok
  ? response.arrayBuffer()
    .then(body => ({body, mime: file.mime || 'application/octet-stream'}))
  : response.json()
    .then(result => Promise.reject(result.error.message));

// Gets the token
const getToken = token => `${token.token_type} ${token.access_token}`;

// Creates fetch download arguments
const downloadArgs = (gapi, file) => ([
  `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
  {
    method: 'GET',
    headers: {
      'Authorization': getToken(gapi.client.getToken())
    }
  }
]);

// Creates fetch upload arguments
const uploadArgs = (gapi, id, file, body) => ([
  `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
  {
    body,
    method: 'PATCH',
    headers: {
      'Content-Type': file.mime || 'application/octet-stream',
      'Authorization': getToken(gapi.client.getToken())
    }
  }
]);

// Crate gapi file resource
const fileResource = file => ({
  name: file.filename || basename(file.path),
  parents: file.parent_id ? [file.parent_id] : [],
  mimeType: file.mime || 'application/octet-stream'
});

// Create gapi folder resource
const folderResource = file => ({
  name: file.filename || basename(file.path),
  parents: file.parent_id ? [file.parent_id] : [],
  mimeType: 'application/vnd.google-apps.folder'
});

// Checks if given file has an ID, if not create
const currentOrCreate = (gapi, file) => file.id
  ? Promise.resolve(file.id)
  : gapi.client.drive.files.create({
    resource: fileResource(file)
  })
    .then(checkResponse)
    .then(res => res.id);

// Our adapter
const adapter = core => {
  const osjsgapi = core.make('osjs/gapi');
  const before = () => osjsgapi.login();

  const readdir = (file, options) => before(file)
    .then(gapi => fileList(core, gapi, file, options));

  const readfile = (file, options) => checkFile(file)
    .then(() => before(file))
    .then(gapi => fetch(...downloadArgs(gapi, file)))
    .then(response => checkDownloadResponse(response, file));

  const writefile = (file, binary, options) => before(file)
    .then((gapi) => {
      return currentOrCreate(gapi, file)
        .then(id => fetch(...uploadArgs(gapi, id, file, binary)))
        .then(response => response.json())
        .then(checkResponse)
        .then(result => result.size || 0);
    });

  const mkdir = (file, options) => checkFile(file)
    .then(() => before(file))
    .then(gapi => gapi.client.drive.files.create({
      resource: folderResource(file)
    }))
    .then(checkResponse);

  const url = (file, options) => checkFile(file)
    .then(() => before(file))
    .then(gapi => gapi.client.drive.files.get({
      fields: 'webContentLink',
      fileId: file.id
    }))
    .then(checkResponse)
    .then(result => result.webContentLink);

  return {readdir, readfile, writefile, mkdir, url};
};

export default adapter;
