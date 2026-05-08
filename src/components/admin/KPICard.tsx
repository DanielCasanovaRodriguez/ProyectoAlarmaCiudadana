import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Skeleton } from '../ui/skeleton';

interface KPICardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  loading?: boolean;
}

export function KPICard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral',
  icon: Icon,
  iconColor = 'text-blue-600',
  loading = false
}: KPICardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  const changeColors = {
    positive: 'text-green-600 bg-green-50',
    negative: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50'
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm text-gray-600">{title}</p>
          <div className={`p-2 rounded-lg bg-opacity-10 ${iconColor.replace('text-', 'bg-')}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
        </div>
        <div>
          <p className="text-3xl font-semibold text-gray-900 mb-1">{value}</p>
          {change && (
            <p className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${changeColors[changeType]}`}>
              {change}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
