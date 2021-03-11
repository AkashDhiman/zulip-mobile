/* @flow strict-local */
import React from 'react';
import { View, Image, ScrollView, Modal, FlatList } from 'react-native';
import type { RouteProp } from '../react-navigation';
import type { SharingNavigationProp } from './SharingScreen';
import * as NavigationService from '../nav/NavigationService';
import type { Dispatch, Auth, GetText, SharedData, UserId } from '../types';
import { createStyleSheet } from '../styles';
import { TranslationContext } from '../boot/TranslationProvider';
import { connect } from '../react-redux';
import { ZulipButton, Input, Label } from '../common';
import UserItem from '../users/UserItem';
import { getAuth } from '../selectors';
import { navigateBack, replaceWithChat } from '../nav/navActions';
import ChooseRecipientsScreen from './ChooseRecipientsScreen';
import { handleSend } from './send';
import { pmNarrowFromRecipients } from '../utils/narrow';
import { pmKeyRecipientsFromIds } from '../utils/recipient';
import { getOwnUserId } from '../users/userSelectors';

const styles = createStyleSheet({
  wrapper: {
    flex: 1,
    padding: 10,
  },
  imagePreview: {
    margin: 10,
    borderRadius: 5,
    width: 200,
    height: 200,
  },
  container: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    margin: 8,
  },
  usersPreview: {
    padding: 10,
  },
  chooseButton: {
    marginTop: 8,
    marginBottom: 8,
    width: '50%',
    alignSelf: 'flex-end',
  },
  message: {
    height: 70,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'whitesmoke',
    padding: 5,
  },
});

type Props = $ReadOnly<{|
  navigation: SharingNavigationProp<'share-to-pm'>,
  route: RouteProp<'share-to-pm', {| sharedData: SharedData |}>,
  ownUserId: UserId,
  dispatch: Dispatch,
  auth: Auth,
|}>;

type State = $ReadOnly<{|
  selectedRecipients: $ReadOnlyArray<UserId>,
  message: string,
  choosingRecipients: boolean,
  sending: boolean,
|}>;

class ShareToPm extends React.Component<Props, State> {
  static contextType = TranslationContext;
  context: GetText;

  state = (() => {
    const { sharedData } = this.props.route.params;
    return {
      selectedRecipients: [],
      message: sharedData.isText ? sharedData.sharedText : '',
      choosingRecipients: false,
      sending: false,
    };
  })();

  handleModalClose = () => {
    this.setState({ choosingRecipients: false });
  };

  setSending = () => {
    this.setState({ sending: true });
  };

  handleChooseRecipients = selectedRecipients => {
    this.setState({ selectedRecipients });
    this.setState({ choosingRecipients: false });
  };

  handleSend = async () => {
    const _ = this.context;
    const { auth } = this.props;
    const { sharedData } = this.props.route.params;
    const { selectedRecipients, message } = this.state;
    const data = { selectedRecipients, message, sharedData, type: 'pm' };

    this.setSending();
    try {
      await handleSend(data, auth, _);
      this.shareSuccess();
    } catch (err) {
      this.finishShare();
    }
  };

  shareSuccess = () => {
    const { selectedRecipients } = this.state;
    const { ownUserId } = this.props;
    const recipients = pmKeyRecipientsFromIds(selectedRecipients, ownUserId);
    const narrow = pmNarrowFromRecipients(recipients);
    NavigationService.dispatch(replaceWithChat(narrow));
  };

  finishShare = () => {
    NavigationService.dispatch(navigateBack());
  };

  handleMessageChange = message => {
    this.setState({ message });
  };

  isSendButtonEnabled = () => {
    const { message, selectedRecipients } = this.state;
    const { sharedData } = this.props.route.params;

    if (sharedData.isText) {
      return message !== '' && selectedRecipients.length > 0;
    }

    return selectedRecipients.length > 0;
  };

  renderUsersPreview = () => {
    const { selectedRecipients } = this.state;

    if (selectedRecipients.length === 0) {
      return <Label text="Please choose recipients to share with" />;
    }
    const preview = [];
    selectedRecipients.forEach(userId => {
      preview.push(<UserItem userId={userId} key={userId} />);
    });
    return preview;
  };

  renderItem = ({ item, index, separators }) =>
    item.type.startsWith('image') ? (
      <Image source={{ uri: item.url }} style={styles.imagePreview} />
    ) : (
      <></>
    );

  render() {
    const { message, choosingRecipients, sending } = this.state;

    if (choosingRecipients) {
      return (
        <Modal onRequestClose={this.handleModalClose}>
          <ChooseRecipientsScreen onComplete={this.handleChooseRecipients} />
        </Modal>
      );
    }

    const { sharedData } = this.props.route.params;

    return (
      <>
        <ScrollView style={styles.wrapper} keyboardShouldPersistTaps="always">
          <View style={styles.container}>
            {sharedData.isText ? (
              <></>
            ) : (
              <FlatList
                data={sharedData.content}
                renderItem={this.renderItem}
                keyExtractor={i => i.url}
                horizontal
              />
            )}
          </View>
          <View style={styles.usersPreview}>{this.renderUsersPreview()}</View>
          <ZulipButton
            onPress={() => this.setState({ choosingRecipients: true })}
            style={styles.chooseButton}
            text="Choose recipients"
          />
          <Input
            value={message}
            placeholder="Message"
            onChangeText={this.handleMessageChange}
            multiline
          />
        </ScrollView>
        <View style={styles.actions}>
          <ZulipButton onPress={this.finishShare} style={styles.button} secondary text="Cancel" />
          <ZulipButton
            style={styles.button}
            onPress={this.handleSend}
            text="Send"
            progress={sending}
            disabled={!this.isSendButtonEnabled()}
          />
        </View>
      </>
    );
  }
}

export default connect(state => ({
  auth: getAuth(state),
  ownUserId: getOwnUserId(state),
}))(ShareToPm);
