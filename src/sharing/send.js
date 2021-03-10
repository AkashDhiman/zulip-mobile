/* @flow strict-local */

import type { SharedData, Auth, GetText, UserId } from '../types';
import { showToast } from '../utils/info';
import { sendMessage, uploadFile } from '../api';

type SendStream = {|
  stream: string,
  topic: string,
  message: string,
  sharedData: SharedData,
  type: 'stream',
|};

type SendPm = {|
  selectedRecipients: $ReadOnlyArray<UserId>,
  message: string,
  sharedData: SharedData,
  type: 'pm',
|};

/**
 * Send received shared data as a message.
 *
 * Sends the shared data received from a 3rd party app and possibly modified
 * by the user, to the server, as a message.
 */
export const handleSend = async (data: SendStream | SendPm, auth: Auth, _: GetText) => {
  const sharedData = data.sharedData;
  let messageToSend = data.message;

  showToast(_('Sending Message...'));
  if (sharedData.type === 'image' || sharedData.type === 'file') {
    let fileName;
    let url;
    if (sharedData.type === 'image') {
      url = sharedData.sharedImageUrl;
      fileName = `image.${sharedData.mimeType.split('/').pop()}`;
    } else {
      url = sharedData.sharedFileUrl;
      fileName = `file.${sharedData.mimeType.split('/').pop()}`;
    }
    const response = await uploadFile(auth, url, fileName);
    messageToSend += `\n[${fileName}](${response.uri})`;
  }

  const messageData =
    data.type === 'pm'
      ? {
          content: messageToSend,
          type: 'private',
          to: JSON.stringify(data.selectedRecipients),
        }
      : {
          content: messageToSend,
          type: 'stream',
          subject: data.topic,
          to: data.stream,
        };

  try {
    await sendMessage(auth, messageData);
    showToast(_('Message sent'));
  } catch (err) {
    showToast(_('Failed to send message'));
    throw new Error(err);
  }
};
