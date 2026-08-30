interface IssueCardProps {
  issue: {
    number: number;
    title: string;
    url: string;
    labels: string[];
    commentsCount: number;
    createdAt: string;
    updatedAt: string;
    isAssigned: boolean;
  };
}

export function IssueCard({ issue }: IssueCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-medium">
          <a href={issue.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            #{issue.number} {issue.title}
          </a>
        </h4>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {issue.labels.map((label) => (
          <span key={label} className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">{label}</span>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span>\uD83D\uDCAC {issue.commentsCount} comments</span>
        <span>Updated {new Date(issue.updatedAt).toLocaleDateString()}</span>
        {issue.isAssigned && <span className="text-orange-600">Assigned</span>}
      </div>
    </div>
  );
}
