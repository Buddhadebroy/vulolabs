import React from 'react';
import { IconComponent } from '@zyra/components';

interface ChatMessageProps {
	sender?: 'ai' | 'user';
	/** adminfont icon glyph shown in the avatar circle - defaults to 'person'. */
	avatarIcon?: string;
	children: React.ReactNode;
}

/**
 * A single chat bubble - avatar circle + free-form content block.
 */
const ChatMessage: React.FC<ChatMessageProps> = ({
	sender = 'person',
	avatarIcon = 'person',
	children,
}) => {
	return (
		<div className={`chat-message chat-message-${sender}`}>
			<span className="chat-message-avatar">
				<IconComponent name={avatarIcon} />
			</span>
			<div className="chat-message-content">{children}</div>
		</div>
	);
};

export default ChatMessage;
