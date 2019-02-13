/**
 * @format
 * @flow
 */

import React, { Fragment, type Node } from 'react';
import { View, Text } from 'react-native';

import { withDispatch, withSelect } from '@wordpress/data';
import { compose } from '@wordpress/compose';

import styles from './block-inflater.scss';

type PropsType = {
	clientId: string,
	hasAttributes: boolean,
	name: string,
	blockNode: mixed,
	inflateBlock: ( blockNode: mixed ) => mixed,
	children?: Node,
};

type StateType = {
	hasRequestedInflation: boolean,
};

export class BlockInflater extends React.Component<PropsType, StateType> {
	hasRequestedInflation = false;

	componentDidMount() {
		if ( ! this.props.hasAttributes && ! this.hasRequestedInflation ) {
			this.props.inflateBlock( this.props.blockNode );
			this.hasRequestedInflation = true;
		}
	}

	render() {
		const { hasAttributes, clientId } = this.props;

		return (
			<Fragment>
				{ hasAttributes && this.props.children }
				{ ! hasAttributes &&
					<View style={ styles.blockInflater }>
						<Text>{ `Need to inflate ${ clientId }` }</Text>
					</View>
				}
			</Fragment>
		);
	}
}

export default compose( [
	withSelect( ( select, { clientId } ) => {
		const { getBlockAttributes, getBlockName, getBlockNode } = select( 'core/editor' );
		const hasAttributes = getBlockAttributes( clientId ) !== undefined;
		const name = getBlockName( clientId );

		return {
			hasAttributes,
			name,
			blockNode: getBlockNode( clientId ),
		};
	} ),
	withDispatch( ( dispatch ) => {
		const { inflateBlock } = dispatch( 'core/editor' );

		return {
			inflateBlock,
		};
	} ),
] )( BlockInflater );
