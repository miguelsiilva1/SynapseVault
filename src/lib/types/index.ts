export interface Course {
  id: string;
  name: string;
  code: string;
  semester: 1 | 2;
  academicYear: string;
  color?: string;
}

export type MaterialType = 'audio' | 'slides' | 'specification' | 'notes';

export interface MaterialUpload {
  id: string;
  courseId: string;
  title: string;
  type: MaterialType;
  fileUrl: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface SynthesizedNote {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  type: 'lecture' | 'project_breakdown' | 'cheat_sheet';
  lectureDate: string;
  contentMarkdown: string;
  frontmatter: Record<string, unknown>;
  createdAt: string;
}

export interface PipelineProgress {
  stage: 'idle' | 'compressing' | 'uploading' | 'transcribing' | 'extracting_slides' | 'synthesizing' | 'completed' | 'error';
  percent: number;
  message: string;
}
