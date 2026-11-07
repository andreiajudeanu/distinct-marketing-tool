class AnalysisError(Exception):
    """A failure the user should read. `message` is shown in the interface."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
