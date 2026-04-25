import { render, screen } from '@/test-utils';
import { MessageList } from './MessageList';
import { MessageListItemData } from '@/lib/models/types/message';

const mockMessages: MessageListItemData[] = [
  {
    messageId: 123,
    timestamp: '2024-02-20T12:00:00Z',
    userId: 'user1',
    source: 'arcade',
    payloadToolkit: 'test-toolkit',
    payloadToolVersion: '1.0.0',
    origin: 'client',
    payloadMessageId: 'msg-789',
    payloadMethod: 'test.method',
    payloadToolName: 'test-tool',
    hasError: false,
    createdAt: '2024-02-20T12:00:00Z',
    alerts: false
  }
];

describe('MessageList', () => {
  it('shows loading state when loading and no messages', () => {
    render(
      <MessageList
        messages={[]}
        isLoading={true}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText('Loading messages...')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(
      <MessageList
        messages={[]}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText('No messages found')).toBeInTheDocument();
  });

  it('renders messages correctly', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText('user1')).toBeInTheDocument();
    expect(screen.getByText('test-tool')).toBeInTheDocument();
    expect(screen.getByText('test-toolkit')).toBeInTheDocument();
    expect(screen.getByText(/2\/20\/2024/)).toBeInTheDocument();
  });

  it('hides user ID column when userId is pinned in initialFilters', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
        initialFilters={{ userId: 'user1' }}
      />
    );

    expect(screen.queryByText('User ID')).not.toBeInTheDocument();
  });

  it('hides toolkit column when payloadToolkit is pinned in initialFilters', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={false}
        onLoadMore={() => {}}
        initialFilters={{ payloadToolkit: 'test-toolkit' }}
      />
    );

    expect(screen.queryByText('test-toolkit')).not.toBeInTheDocument();
  });

  it('shows load more button when hasMore is true', () => {
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={true}
        onLoadMore={() => {}}
      />
    );

    expect(screen.getByText('Load More')).toBeInTheDocument();
  });

  it('calls onLoadMore when load more button is clicked', () => {
    const handleLoadMore = jest.fn();
    render(
      <MessageList
        messages={mockMessages}
        isLoading={false}
        hasMore={true}
        onLoadMore={handleLoadMore}
      />
    );

    screen.getByText('Load More').click();
    expect(handleLoadMore).toHaveBeenCalled();
  });
});
