
export interface GroundingSource {
  uri: string;
  title: string;
}

export interface NewsTopic {
  topic: string;
  summary: string;
  sources: GroundingSource[];
}
