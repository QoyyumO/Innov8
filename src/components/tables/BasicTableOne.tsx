import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';

import Image from 'next/image';
import Badge from '../ui/badge/Badge';

// Define the table data using the interface
const tableData = [
  {
    id: 1,
    candidate: {
      image: '/images/user/user-17.jpg',
      name: 'Kehinde Banasko',
    },
    assessment: 'ML Fundamentals',
    role: 'Data Scientist',
    level: 'Entry',
    score: 82,
    status: 'Passed',
  },
  {
    id: 2,
    candidate: {
      image: '/images/user/user-18.jpg',
      name: 'Kaiya George',
    },
    assessment: 'Data Engineering Basics',
    role: 'Data Engineer',
    level: 'Intermediate',
    score: 67,
    status: 'Passed',
  },
  {
    id: 3,
    candidate: {
      image: '/images/user/user-19.jpg',
      name: 'Zain Geidt',
    },
    assessment: 'Deep Learning',
    role: 'ML Engineer',
    level: 'Advanced',
    score: 49,
    status: 'Failed',
  },
  {
    id: 4,
    candidate: {
      image: '/images/user/user-20.jpg',
      name: 'Abram Schleifer',
    },
    assessment: 'Statistics',
    role: 'Data Analyst',
    level: 'Entry',
    score: 74,
    status: 'Passed',
  },
  {
    id: 5,
    candidate: {
      image: '/images/user/user-21.jpg',
      name: 'Carla George',
    },
    assessment: 'ML Fundamentals',
    role: 'Data Scientist',
    level: 'Expert',
    score: 91,
    status: 'Passed',
  },
];

export default function BasicTableOne() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1102px]">
          <Table>
            {/* Table Header */}
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="text-theme-xs px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                >
                  Candidate
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                >
                  Assessment
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                >
                  Role
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                >
                  Level
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                >
                  Score
                </TableCell>
                <TableCell
                  isHeader
                  className="text-theme-xs px-5 py-3 text-start font-medium text-gray-500 dark:text-gray-400"
                >
                  Status
                </TableCell>
              </TableRow>
            </TableHeader>

            {/* Table Body */}
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {tableData.map(record => (
                <TableRow key={record.id}>
                  <TableCell className="px-5 py-4 text-start sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full">
                        <Image
                          width={40}
                          height={40}
                          src={record.candidate.image}
                          alt={record.candidate.name}
                        />
                      </div>
                      <div>
                        <Link
                          href={`/candidates/${record.candidate.name.replace(' ', '-')}`}
                        >
                          <span className="text-theme-sm block font-medium text-gray-800 dark:text-white/90">
                            {record.candidate.name}
                          </span>
                        </Link>
                        <span className="text-theme-xs block text-gray-500 dark:text-gray-400">
                          {/* {record.role} */}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                    {record.assessment}
                  </TableCell>
                  <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                    {record.role}
                  </TableCell>
                  <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                    {record.level}
                  </TableCell>
                  <TableCell className="text-theme-sm px-4 py-3 font-semibold text-gray-800 dark:text-white/90">
                    {record.score}
                  </TableCell>
                  <TableCell className="text-theme-sm px-4 py-3 text-start text-gray-500 dark:text-gray-400">
                    <Badge
                      size="sm"
                      color={record.status === 'Passed' ? 'success' : 'error'}
                    >
                      {record.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
