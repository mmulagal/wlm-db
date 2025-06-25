interface DiagramDefinition {
    Diagram: DiagramContent;
}

interface DiagramContent {
    DefinitionFiles: DefinitionFile[];
    Resources: Resources;
    Links: Link[];
}

interface DefinitionFile {
    Type: string;
    Url?: string;
}

interface Resources {
    [key: string]: Resource;
}

interface Resource {
    Type: string;
    Title?: string;
    Preset?: string;
    Icon?: string;
    Direction?: string;
    Children?: string[];
}

interface Link {
    Source: string;
    SourcePosition: string;
    SourceArrowHead?: {
        Type: string;
    };
    Target: string;
    TargetPosition: string;
    TargetArrowHead?: {
        Type: string;
    };
    Type?: string;
}

export { DiagramDefinition, DiagramContent, DefinitionFile, Resources, Resource, Link };
