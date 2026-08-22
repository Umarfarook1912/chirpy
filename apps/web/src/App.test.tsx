import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from './hooks/useAuth';
import { DashboardPage } from './pages/Dashboard/DashboardPage';
import type { AuthContextValue } from './hooks/useAuth';

vi.mock('./api/meeting.api', () => ({
  meetingApi: {
    list: vi.fn().mockResolvedValue({ meetings: [], total: 0, page: 1, limit: 20 }),
  },
}));

vi.mock('./api/organization.api', () => ({
  organizationApi: {
    get: vi.fn().mockResolvedValue({
      id: 'org1',
      name: 'Test Org',
      slug: 'test-org',
      ownerId: 'user1',
      memberCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  },
}));

const mockAuth: AuthContextValue = {
  user: {
    id: '1',
    email: 'test@example.com',
    displayName: 'Test User',
    role: 'member',
    organizationId: 'org1',
    organizationName: 'Test Org',
  },
  isLoading: false,
  login: async () => undefined,
  register: async () => undefined,
  logout: async () => undefined,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={mockAuth}>
        <MemoryRouter>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('DashboardPage', () => {
  it('renders loading state initially', () => {
    render(
      <TestWrapper>
        <DashboardPage />
      </TestWrapper>,
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
