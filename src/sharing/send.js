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
  if (!sharedData.isText) {
    const { content } = sharedData;
    for (let i = 0; i < content.length; i++) {
      const name = `shared-content-${i + 1}`;
      const ext = content[i].type.split('/').pop();
      const fileName = `${name}.${ext}`;
      const response = await uploadFile(auth, content[i].url, fileName);
      messageToSend += `\n[${fileName}](${response.uri})`;
    }
  }

  showToast(_('Sending Message...'));

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
