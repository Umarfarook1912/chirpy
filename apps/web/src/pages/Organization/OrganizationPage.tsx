import { Typography } from '../../ui/atoms/Typography';
import { Spinner } from '../../ui/atoms/Spinner';
import { useOrganization, useOrganizationMembers } from '../../hooks/useOrganization';
import { formatDate } from '../../utils/date.utils';
import { getInitials } from '../../utils/format.utils';
import { ROLE_LABELS } from '@chirpy/shared';
import styles from './OrganizationPage.module.scss';

export function OrganizationPage() {
  const { data: org, isLoading: orgLoading } = useOrganization();
  const { data: members, isLoading: membersLoading } = useOrganizationMembers();

  if (orgLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Typography variant="h2">{org?.name ?? 'Organization'}</Typography>

      <section className={styles.section}>
        <Typography variant="h3">Members</Typography>
        {membersLoading ? (
          <Spinner size="md" />
        ) : (
          <div className={styles.memberList}>
            {members?.map((member) => (
              <div key={member.userId} className={styles.memberRow}>
                <div className={styles.avatar}>
                  {getInitials(member.displayName)}
                </div>
                <div className={styles.memberInfo}>
                  <Typography variant="label">{member.displayName}</Typography>
                  <Typography variant="caption" color="secondary">
                    {member.email} · Joined {formatDate(member.joinedAt)}
                  </Typography>
                </div>
                <Typography variant="caption" color="secondary">
                  {ROLE_LABELS[member.role]}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
