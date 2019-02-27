/** @flow
 * @format */

import React from 'react';
import {
	subscribeParentGetHtml,
	subscribeParentToggleHTMLMode,
	subscribeSetTitle,
	subscribeUpdateHtml,
} from 'react-native-gutenberg-bridge';

import { BlockList } from '@wordpress/editor';
import { SlotFillProvider } from '@wordpress/components';
import { PostTitle } from '@wordpress/editor';
import { __ } from '@wordpress/i18n';

import type { EmitterSubscription } from 'react-native';
import styles from './block-manager.scss';

type PropsType = {
	rootClientId: ?string,
	serializeToNativeAction: void => void,
	toggleHtmlModeAction: void => void,
	setTitleAction: string => void,
	updateHtmlAction: string => void,
	title: string,
};

type StateType = {};

export default class MainScreen extends React.Component<PropsType, StateType> {
	subscriptionParentGetHtml: ?EmitterSubscription;
	subscriptionParentToggleHTMLMode: ?EmitterSubscription;
	subscriptionParentSetTitle: ?EmitterSubscription;
	subscriptionParentUpdateHtml: ?EmitterSubscription;

	constructor( props: PropsType ) {
		super( props );

		this.state = {
			isFullyBordered: true,
		};
	}

	componentDidMount() {
		this.subscriptionParentGetHtml = subscribeParentGetHtml( () => {
			this.props.serializeToNativeAction();
		} );

		this.subscriptionParentToggleHTMLMode = subscribeParentToggleHTMLMode( () => {
			this.props.toggleHtmlModeAction();
		} );

		this.subscriptionParentSetTitle = subscribeSetTitle( ( payload ) => {
			this.props.setTitleAction( payload.title );
		} );

		this.subscriptionParentUpdateHtml = subscribeUpdateHtml( ( payload ) => {
			this.props.updateHtmlAction( payload.html );
		} );
	}

	componentWillUnmount() {
		if ( this.subscriptionParentGetHtml ) {
			this.subscriptionParentGetHtml.remove();
		}
		if ( this.subscriptionParentToggleHTMLMode ) {
			this.subscriptionParentToggleHTMLMode.remove();
		}
		if ( this.subscriptionParentSetTitle ) {
			this.subscriptionParentSetTitle.remove();
		}
		if ( this.subscriptionParentUpdateHtml ) {
			this.subscriptionParentUpdateHtml.remove();
		}
	}

	blockHolderBorderStyle() {
		return this.state.isFullyBordered ? styles.blockHolderFullBordered : styles.blockHolderSemiBordered;
	}

	renderHeader() {
		return (
			<PostTitle
				innerRef={ ( ref ) => {
					this.postTitleRef = ref;
				} }
				title={ this.props.title }
				onUpdate={ this.props.setTitleAction }
				placeholder={ __( 'Add title' ) }
				borderStyle={ this.blockHolderBorderStyle() }
				focusedBorderColor={ styles.blockHolderFocused.borderColor } />
		);
	}

	render() {
		return (
			<SlotFillProvider>
				{ this.renderHeader() }
				<BlockList { ...this.props } />
			</SlotFillProvider>
		);
	}
}
